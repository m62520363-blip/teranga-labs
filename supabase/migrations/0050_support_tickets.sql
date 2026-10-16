-- ============================================================
-- 0050_support_tickets.sql
-- P4 — Clôture audit C11/§31 : support utilisateur (tickets +
-- messages). NON destructif.
--
-- Un ticket appartient à son créateur ; seul le propriétaire le
-- voit et peut y répondre. La réponse du support arrive via la
-- console admin (service_role) plus tard : le champ is_staff des
-- messages distingue déjà les deux voix.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'answered', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON public.support_tickets (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_staff BOOLEAN NOT NULL DEFAULT FALSE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON public.support_messages (ticket_id, created_at);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='support_tickets_select_own') THEN
    CREATE POLICY "support_tickets_select_own"
      ON public.support_tickets FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_messages' AND policyname='support_messages_select_own') THEN
    CREATE POLICY "support_messages_select_own"
      ON public.support_messages FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.support_tickets st
         WHERE st.id = ticket_id AND st.user_id = auth.uid()
      ));
  END IF;
END $$;

-- Écriture uniquement via les RPC ci-dessous.

-- ------------------------------------------------------------
-- 2. RPC create_support_ticket : ticket + premier message,
--    anti-spam (5 tickets ouverts maximum).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_subject TEXT,
  p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_subject TEXT := NULLIF(TRIM(COALESCE(p_subject, '')), '');
  v_body TEXT := NULLIF(TRIM(COALESCE(p_body, '')), '');
  v_ticket_id UUID;
  v_open_count INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  IF v_subject IS NULL OR LENGTH(v_subject) < 5 THEN
    RAISE EXCEPTION 'Sujet trop court (5 caractères minimum).' USING ERRCODE = 'TLBAD';
  END IF;
  IF v_subject IS NOT NULL AND LENGTH(v_subject) > 120 THEN
    RAISE EXCEPTION 'Sujet trop long (120 caractères maximum).' USING ERRCODE = 'TLBAD';
  END IF;
  IF v_body IS NULL OR LENGTH(v_body) < 10 THEN
    RAISE EXCEPTION 'Message trop court (10 caractères minimum).' USING ERRCODE = 'TLBAD';
  END IF;
  IF LENGTH(v_body) > 4000 THEN
    RAISE EXCEPTION 'Message trop long (4000 caractères maximum).' USING ERRCODE = 'TLBAD';
  END IF;

  SELECT COUNT(*) INTO v_open_count
    FROM public.support_tickets
   WHERE user_id = v_user AND status = 'open';
  IF v_open_count >= 5 THEN
    RAISE EXCEPTION 'Trop de tickets ouverts (5 maximum) : attendez une réponse.' USING ERRCODE = 'TLLIM';
  END IF;

  INSERT INTO public.support_tickets (user_id, subject)
  VALUES (v_user, v_subject)
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.support_messages (ticket_id, author_id, is_staff, body)
  VALUES (v_ticket_id, v_user, FALSE, v_body);

  RETURN JSONB_BUILD_OBJECT('id', v_ticket_id, 'status', 'open');
END;
$$;

-- ------------------------------------------------------------
-- 3. RPC reply_support_ticket : réponse du créateur ; remet le
--    ticket en attente de réponse staff.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reply_support_ticket(
  p_ticket_id UUID,
  p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_body TEXT := NULLIF(TRIM(COALESCE(p_body, '')), '');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  IF v_body IS NULL OR LENGTH(v_body) < 2 THEN
    RAISE EXCEPTION 'Message trop court.' USING ERRCODE = 'TLBAD';
  END IF;
  IF LENGTH(v_body) > 4000 THEN
    RAISE EXCEPTION 'Message trop long (4000 caractères maximum).' USING ERRCODE = 'TLBAD';
  END IF;

  UPDATE public.support_tickets
     SET status = 'open', updated_at = NOW()
   WHERE id = p_ticket_id AND user_id = v_user AND status <> 'closed';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable ou fermé.' USING ERRCODE = 'TLNOD';
  END IF;

  INSERT INTO public.support_messages (ticket_id, author_id, is_staff, body)
  VALUES (p_ticket_id, v_user, FALSE, v_body);

  RETURN JSONB_BUILD_OBJECT('id', p_ticket_id, 'status', 'open');
END;
$$;

-- ------------------------------------------------------------
-- 4. RPC list_my_tickets : mes tickets + dernier message.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_my_tickets()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;

  RETURN COALESCE((
    SELECT JSONB_AGG(t ORDER BY t.updated_at DESC)
    FROM (
      SELECT st.id, st.subject, st.status, st.created_at, st.updated_at,
             (SELECT COUNT(*) FROM public.support_messages sm WHERE sm.ticket_id = st.id) AS message_count,
             (SELECT sm.body FROM public.support_messages sm WHERE sm.ticket_id = st.id ORDER BY sm.created_at DESC LIMIT 1) AS last_message
        FROM public.support_tickets st
       WHERE st.user_id = v_user
    ) t
  ), '[]'::JSONB);
END;
$$;

-- ------------------------------------------------------------
-- 5. RPC close_support_ticket : fermeture par le créateur.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_support_ticket(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;

  UPDATE public.support_tickets
     SET status = 'closed', updated_at = NOW()
   WHERE id = p_ticket_id AND user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable.' USING ERRCODE = 'TLNOD';
  END IF;

  RETURN JSONB_BUILD_OBJECT('id', p_ticket_id, 'status', 'closed');
END;
$$;

REVOKE ALL ON FUNCTION public.create_support_ticket(TEXT, TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.reply_support_ticket(UUID, TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.reply_support_ticket(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.list_my_tickets() FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.list_my_tickets() TO authenticated;
REVOKE ALL ON FUNCTION public.close_support_ticket(UUID) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.close_support_ticket(UUID) TO authenticated;

COMMIT;