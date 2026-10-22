-- ============================================================
-- 0067 : notification_preferences — source de vérité des
-- préférences de notifications, avec gating de notify_user.
--
-- Avant : les toggles de l'écran Paramètres écrivaient
-- auth.users.raw_user_meta_data ('email_prefs') que RIEN ne lisait :
-- notify_user insérait toujours (audit : « Aucun gating »).
-- Après :
--   1. table notification_preferences (RLS : chacun le sien) ;
--   2. backfill des prefs existantes depuis raw_user_meta_data ;
--   3. notify_user respecte la colonne in_app (false = pas
--      d'insertion in-app). Absence de ligne = actif (comportement
--      inchangé pour les comptes sans préférence explicite).
-- ============================================================

-- 1. Table ---------------------------------------------------

create table if not exists public.notification_preferences (
  user_id uuid primary key default auth.uid()
    references auth.users (id) on delete cascade,
  in_app boolean not null default true,
  email_contact boolean not null default true,
  email_replies boolean not null default true,
  email_unread_reminders boolean not null default true,
  email_price_offers boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is
  'Préférences de notifications par utilisateur (in-app + e-mails). '
  'Remplace user_metadata.email_prefs, non lus côté SQL.';

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_select_own"
  on public.notification_preferences for select
  to authenticated
  using (user_id = auth.uid());

create policy "notification_preferences_insert_own"
  on public.notification_preferences for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "notification_preferences_update_own"
  on public.notification_preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2. Backfill des préférences existantes (user_metadata -> table).
--    Seuls les comptes ayant déjà un objet email_prefs reçoivent une
--    ligne ; les autres restent au défaut « tout actif ».

insert into public.notification_preferences (
  user_id,
  email_contact,
  email_replies,
  email_unread_reminders,
  email_price_offers
)
select
  u.id,
  coalesce((u.raw_user_meta_data -> 'email_prefs' ->> 'contact')::boolean, true),
  coalesce((u.raw_user_meta_data -> 'email_prefs' ->> 'replies')::boolean, true),
  coalesce((u.raw_user_meta_data -> 'email_prefs' ->> 'unreadReminders')::boolean, true),
  coalesce((u.raw_user_meta_data -> 'email_prefs' ->> 'priceOffers')::boolean, true)
from auth.users u
where u.raw_user_meta_data -> 'email_prefs' is not null
on conflict (user_id) do nothing;

-- 3. Gating : notify_user ne crée plus de notification in-app
--    pour un utilisateur l'ayant désactivée. Signature et grants
--    inchangés (CREATE OR REPLACE conserve les privilèges de 0031).

CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_link TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nid UUID;
  v_in_app BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Préférence explicite : in_app = false -> aucun insert.
  -- Absence de ligne -> actif (défaut).
  SELECT p.in_app INTO v_in_app
  FROM public.notification_preferences p
  WHERE p.user_id = p_user_id;

  IF NOT coalesce(v_in_app, true) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, entity_type, entity_id)
  VALUES (p_user_id, p_type, p_title, p_body, p_link, p_entity_type, p_entity_id)
  RETURNING id INTO v_nid;

  RETURN v_nid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
