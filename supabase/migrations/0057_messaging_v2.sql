-- ============================================================
-- 0057_messaging_v2.sql
-- Messagerie professionnelle : messages vocaux, édition,
-- suppression douce, marquage lu par RPC, présence en ligne.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Colonnes messages
-- ------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS audio_path TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration_seconds INTEGER
    CHECK (audio_duration_seconds IS NULL OR (audio_duration_seconds > 0 AND audio_duration_seconds <= 600));

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text', 'offer', 'system', 'audio'));

-- ------------------------------------------------------------
-- 2. Bucket audio privé (jamais de lecture publique)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-audio',
  'message-audio',
  false,
  5242880,
  array['audio/webm', 'audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "message-audio-insert" ON storage.objects;
CREATE POLICY "message-audio-insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'message-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(name) ~ '\.(webm|mp3|ogg|m4a|wav)$'
  );

DROP POLICY IF EXISTS "message-audio-delete" ON storage.objects;
CREATE POLICY "message-audio-delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'message-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Pas de policy SELECT : lecture exclusivement via API signed URL.

-- ------------------------------------------------------------
-- 3. Trigger de protection UPDATE messages (colonnes présentes)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_messages_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN NEW;
  END IF;
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.message_type IS DISTINCT FROM OLD.message_type THEN
    RAISE EXCEPTION 'Message immuable (conversation, expéditeur, type).' USING ERRCODE = 'TLPRV';
  END IF;
  IF NEW.read_at IS DISTINCT FROM OLD.read_at
     AND NEW.content IS DISTINCT FROM OLD.content THEN
    RAISE EXCEPTION 'Modification invalide.' USING ERRCODE = 'TLPRV';
  END IF;
  IF NEW.read_at IS DISTINCT FROM OLD.read_at THEN
    IF OLD.sender_id = auth.uid() THEN
      RETURN NEW;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.conversations c
       WHERE c.id = OLD.conversation_id
         AND (c.developer_id = auth.uid() OR c.client_id = auth.uid())
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Non participant.' USING ERRCODE = 'TLPRV';
  END IF;
  IF NEW.content IS DISTINCT FROM OLD.content
     OR NEW.edited_at IS DISTINCT FROM OLD.edited_at
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    IF OLD.sender_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Seul l''expéditeur peut modifier son message.' USING ERRCODE = 'TLPRV';
    END IF;
    IF OLD.message_type = 'audio' AND NEW.deleted_at IS NULL THEN
      RAISE EXCEPTION 'Un message vocal ne peut pas être édité.' USING ERRCODE = 'TLPRV';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_messages_update_trigger ON public.messages;
CREATE TRIGGER protect_messages_update_trigger
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.protect_messages_update();

-- ------------------------------------------------------------
-- 4. Présence
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_presence_select_own ON public.user_presence;
CREATE POLICY user_presence_select_own ON public.user_presence
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Écriture via RPC uniquement.
REVOKE ALL ON public.user_presence FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_presence()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.user_presence (user_id, last_seen_at, updated_at)
  VALUES (v_user, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = now(), updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.touch_presence() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_presence() TO authenticated;

-- Présence d'un pair : seulement si une conversation partagée existe.
CREATE OR REPLACE FUNCTION public.get_peer_presence(p_peer_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_last timestamptz;
  v_online boolean := false;
BEGIN
  IF v_user IS NULL OR p_peer_id IS NULL OR p_peer_id = v_user THEN
    RETURN jsonb_build_object('online', false, 'last_seen_at', null);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
     WHERE ((c.developer_id = v_user AND c.client_id = p_peer_id)
         OR (c.client_id = v_user AND c.developer_id = p_peer_id))
  ) THEN
    RETURN jsonb_build_object('online', false, 'last_seen_at', null);
  END IF;
  SELECT last_seen_at INTO v_last
    FROM public.user_presence
   WHERE user_id = p_peer_id;
  v_online := v_last IS NOT NULL AND v_last > now() - interval '90 seconds';
  RETURN jsonb_build_object('online', v_online, 'last_seen_at', v_last);
END;
$$;

REVOKE ALL ON FUNCTION public.get_peer_presence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_peer_presence(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 5. RPC messagerie
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_message(
  p_conversation_id uuid,
  p_content text default '',
  p_message_type text default 'text',
  p_audio_path text default null,
  p_audio_duration_seconds integer default null,
  p_metadata jsonb default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_conv public.conversations%ROWTYPE;
  v_msg public.messages%ROWTYPE;
  v_type text := coalesce(nullif(btrim(p_message_type), ''), 'text');
  v_content text := coalesce(p_content, '');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  IF p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Conversation manquante.' USING ERRCODE = 'TLBAD';
  END IF;

  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id FOR UPDATE;
  IF v_conv.id IS NULL OR (v_conv.developer_id <> v_user AND v_conv.client_id <> v_user) THEN
    RAISE EXCEPTION 'Conversation introuvable.' USING ERRCODE = 'TLNOC';
  END IF;
  IF v_conv.status NOT IN ('active', 'awarded') THEN
    RAISE EXCEPTION 'Conversation fermée.' USING ERRCODE = 'TLCLO';
  END IF;

  IF v_type = 'audio' THEN
    IF nullif(btrim(coalesce(p_audio_path, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Chemin audio manquant.' USING ERRCODE = 'TLBAD';
    END IF;
    IF NOT (p_audio_path LIKE v_user::text || '/%') THEN
      RAISE EXCEPTION 'Chemin audio invalide.' USING ERRCODE = 'TLBAD';
    END IF;
    v_content := '';
  ELSIF v_type <> 'text' THEN
    RAISE EXCEPTION 'Type de message non envoyable.' USING ERRCODE = 'TLBAD';
  ELSE
    v_content := btrim(v_content);
    IF v_content = '' OR length(v_content) > 5000 THEN
      RAISE EXCEPTION 'Message vide ou trop long.' USING ERRCODE = 'TLBAD';
    END IF;
  END IF;

  INSERT INTO public.messages (
    conversation_id, sender_id, content, message_type, metadata, audio_path, audio_duration_seconds
  ) VALUES (
    p_conversation_id, v_user, v_content, v_type, p_metadata,
    CASE WHEN v_type = 'audio' THEN p_audio_path END,
    CASE WHEN v_type = 'audio' THEN p_audio_duration_seconds END
  )
  RETURNING * INTO v_msg;

  UPDATE public.conversations SET last_message_at = now() WHERE id = p_conversation_id;

  RETURN jsonb_build_object(
    'id', v_msg.id,
    'conversation_id', v_msg.conversation_id,
    'sender_id', v_msg.sender_id,
    'content', v_msg.content,
    'message_type', v_msg.message_type,
    'audio_path', v_msg.audio_path,
    'audio_duration_seconds', v_msg.audio_duration_seconds,
    'created_at', v_msg.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.send_message(uuid, text, text, text, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text, text, text, integer, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.edit_message(p_message_id uuid, p_content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_msg public.messages%ROWTYPE;
  v_content text := btrim(coalesce(p_content, ''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  IF v_content = '' OR length(v_content) > 5000 THEN
    RAISE EXCEPTION 'Message vide ou trop long.' USING ERRCODE = 'TLBAD';
  END IF;
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF v_msg.id IS NULL OR v_msg.sender_id <> v_user THEN
    RAISE EXCEPTION 'Message non modifiable.' USING ERRCODE = 'TLPRV';
  END IF;
  IF v_msg.message_type = 'audio' THEN
    RAISE EXCEPTION 'Un message vocal ne peut pas être édité.' USING ERRCODE = 'TLPRV';
  END IF;
  UPDATE public.messages
     SET content = v_content, edited_at = now()
   WHERE id = p_message_id;
  RETURN jsonb_build_object('id', p_message_id, 'content', v_content, 'edited_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.edit_message(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_message(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.soft_delete_message(p_message_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_msg public.messages%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF v_msg.id IS NULL OR v_msg.sender_id <> v_user THEN
    RAISE EXCEPTION 'Message non supprimable.' USING ERRCODE = 'TLPRV';
  END IF;
  UPDATE public.messages
     SET deleted_at = now(), content = '', audio_path = NULL
   WHERE id = p_message_id;
  RETURN jsonb_build_object('id', p_message_id, 'deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_message(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
     WHERE c.id = p_conversation_id
       AND (c.developer_id = v_user OR c.client_id = v_user)
  ) THEN
    RAISE EXCEPTION 'Conversation introuvable.' USING ERRCODE = 'TLNOC';
  END IF;
  UPDATE public.messages
     SET read_at = coalesce(read_at, now())
   WHERE conversation_id = p_conversation_id
     AND sender_id <> v_user
     AND read_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('marked', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 6. URL signée d'un message vocal (participant uniquement)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_message_audio_url(p_message_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_msg public.messages%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id;
  IF v_msg.id IS NULL OR v_msg.message_type <> 'audio'
     OR v_msg.audio_path IS NULL OR v_msg.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Audio introuvable.' USING ERRCODE = 'TLNFA';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
     WHERE c.id = v_msg.conversation_id
       AND (c.developer_id = v_user OR c.client_id = v_user)
  ) THEN
    RAISE EXCEPTION 'Accès interdit.' USING ERRCODE = 'TLPRV';
  END IF;
  RETURN jsonb_build_object(
    'path', v_msg.audio_path,
    'duration_seconds', v_msg.audio_duration_seconds
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_message_audio_url(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_message_audio_url(uuid) TO authenticated;

COMMIT;
