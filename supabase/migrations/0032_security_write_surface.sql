-- ============================================================
-- TERANGA LABS — Migration 0032 : fermeture des écritures
-- directes visiteurs + anti-spam sur le formulaire de contact
--
-- Constats de l'audit du catalogue (migrations 0001 → 0031) :
--
--  1. Deux politiques RLS d'INSERT ouvertes à un visiteur
--     (with check (true)) sont restées en place alors que toute
--     l'écriture passe désormais par des RPC validantes :
--
--     - "requests_public_create" (0002) : n'importe quel visiteur
--       pouvait insérer un brief DIRECTEMENT dans public.requests
--       via PostgREST, court-circuitant publish_brief (session +
--       1 Token) et toute validation. C'est le vrai chemin du
--       "spam de briefs" qui figurait à la roadmap — pas la RPC
--       create_brief, déjà révoquée en 0007.
--
--     - "contact_messages_insert_public" (0023) : insert direct
--       dans contact_messages, contournant submit_contact_message
--       (validation + anti-spam).
--
--  2. Ces politiques n'étaient PAS détectées par le test 5 de
--     supabase/tests/permissions.sql : il cherchait les rôles par
--     égalité (roles = '{anon}'), or elles sont posées sur
--     {anon, authenticated}. Le test est durci (opérateur &&)
--     dans cette même révision pour que toute future politique
--     écrite pour anon soit détectée quel que soit le rôle
--     supplémentaire.
--
--  3. submit_contact_message notifiait TOUS les administrateurs
--     à chaque envoi, sans limite : un visiteur pouvait spammer
--     les notifications admin ad vitam. Ajout d'un verrou de
--     fenêtre glissante : 3 messages maximum par adresse email
--     sur 24 h (errcode TLLIM), indexé sur (email, created_at).
--
-- L'écriture directe conserve une porte de lecture publique
-- (listes de briefs), mais TOUTE création passe par une fonction.
-- ============================================================

-- ------------------------------------------------------------
-- 1. public.requests : plus d'INSERT direct par un client.
--    Le seul chemin de création est publish_brief (session + 1 Token).
-- ------------------------------------------------------------
drop policy if exists requests_public_create on public.requests;
revoke insert on public.requests from anon, authenticated;

-- ------------------------------------------------------------
-- 2. public.contact_messages : plus d'INSERT direct.
--    Le seul chemin est submit_contact_message (validé + limité).
-- ------------------------------------------------------------
drop policy if exists contact_messages_insert_public on public.contact_messages;
revoke insert on public.contact_messages from anon, authenticated;

-- Index de la fenêtre anti-spam.
create index if not exists contact_messages_email_created_idx
  on public.contact_messages (email, created_at desc);

-- ------------------------------------------------------------
-- 3. submit_contact_message : fenêtre glissante 24 h par email.
-- ------------------------------------------------------------
create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_message text,
  p_subject text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_subject text := nullif(btrim(coalesce(p_subject, '')), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  r record;
begin
  if v_name is null or length(v_name) < 2 then
    raise exception 'Votre nom est requis.' using errcode = 'TLBAD';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Adresse email invalide.' using errcode = 'TLBAD';
  end if;
  if v_message is null or length(v_message) < 10 then
    raise exception 'Décrivez votre demande (10 caractères minimum).' using errcode = 'TLBAD';
  end if;
  if length(v_message) > 5000 then
    raise exception 'Message trop long (5 000 caractères maximum).' using errcode = 'TLBAD';
  end if;
  if v_subject is not null and length(v_subject) > 200 then
    raise exception 'Objet trop long (200 caractères maximum).' using errcode = 'TLBAD';
  end if;

  -- Anti-spam : 3 messages max par adresse email sur 24 h glissantes.
  if (
    select count(*)::int
      from public.contact_messages
     where email = v_email
       and created_at > now() - interval '24 hours'
  ) >= 3 then
    raise exception 'Trop de messages envoyés depuis cette adresse. Réessayez plus tard.'
      using errcode = 'TLLIM';
  end if;

  insert into public.contact_messages (name, email, subject, message)
  values (v_name, v_email, v_subject, v_message);

  for r in (
    select user_id from public.user_roles where role = 'admin'
  ) loop
    perform public.notify_user(
      r.user_id,
      'contact_message',
      'Nouveau message de contact',
      format('De %s (%s) : %s', v_name, v_email, left(v_message, 120)),
      '/contact'
    );
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

-- Les privilèges d'exécution du RPC sont inchangés (anon + authenticated).