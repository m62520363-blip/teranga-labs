-- ============================================================
-- TERANGA LABS — Migration 0025 : onboarding développeur complet
-- + validation manuelle par l'admin + vérification payante.
--
-- Parcours :
--   inscription 2 étapes → PENDING → admin APPROUVE → ACTIVE
--   → (option) demande de vérification payante → PAIEMENT
--   → PAIEMENT CONFIRMÉ → VÉRIFICATION EN ATTENTE → VÉRIFIÉ
-- ============================================================

-- ------------------------------------------------------------
-- 1. Statuts du compte développeur (états exacts demandés)
-- ------------------------------------------------------------
alter table public.developers
  drop constraint if exists developers_status_check;

alter table public.developers
  add constraint developers_status_check
  check (status in (
    'pending',            -- inscription reçue, en attente d'approbation
    'active',             -- compte approuvé
    'verification_pending', -- demande de vérification envoyée
    'verified',           -- profil vérifié par TERANGA LABS
    'rejected',           -- compte ou demande refusé
    'changes_requested',  -- modifications demandées
    'suspended'           -- compte suspendu (modération)
  ));

-- Colonnes d'identité complétées à l'étape 1.
alter table public.developers
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists address text,
  add column if not exists country text,
  add column if not exists phone text;

-- Dernier retour de l'administration (rejet / modifications).
alter table public.developers
  add column if not exists rejection_reason text;

-- ------------------------------------------------------------
-- 2. developer_profiles : profil professionnel (étape 2), 1:1
-- ------------------------------------------------------------
create table if not exists public.developer_profiles (
  developer_id uuid primary key references public.developers(id) on delete cascade,
  professional_title text,
  main_specialty text,
  availability text check (
    availability is null or availability in ('available_now', 'available_soon', 'on_mission')
  ),
  rate_min_fcfa integer check (rate_min_fcfa is null or rate_min_fcfa >= 0),
  rate_max_fcfa integer check (rate_max_fcfa is null or rate_max_fcfa >= 0),
  currency text not null default 'FCFA',
  projects_estimate integer check (projects_estimate is null or projects_estimate >= 0),
  experience_level text check (
    experience_level is null or experience_level in ('debutant', 'intermediaire', 'avance', 'expert')
  ),
  terms_accepted_at timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.developer_profiles enable row level security;

drop policy if exists developer_profiles_select_own on public.developer_profiles;
create policy developer_profiles_select_own on public.developer_profiles
  for select using (developer_id = auth.uid());

-- ------------------------------------------------------------
-- 3. developer_services : services proposés (multi-choix)
-- ------------------------------------------------------------
create table if not exists public.developer_services (
  developer_id uuid not null references public.developers(id) on delete cascade,
  service text not null,
  created_at timestamptz not null default now(),
  primary key (developer_id, service)
);

alter table public.developer_services enable row level security;

drop policy if exists developer_services_select_own on public.developer_services;
create policy developer_services_select_own on public.developer_services
  for select using (developer_id = auth.uid());

-- ------------------------------------------------------------
-- 4. developer_projects : portfolio (plusieurs projets)
-- ------------------------------------------------------------
create table if not exists public.developer_projects (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developers(id) on delete cascade,
  name text not null,
  description text,
  project_type text,
  technologies text[] not null default '{}'::text[],
  url text,
  screenshots text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create index if not exists developer_projects_developer_idx on public.developer_projects (developer_id);

alter table public.developer_projects enable row level security;

drop policy if exists developer_projects_select_own on public.developer_projects;
create policy developer_projects_select_own on public.developer_projects
  for select using (developer_id = auth.uid());

-- ------------------------------------------------------------
-- 5. developer_documents : CV & documents professionnels
-- ------------------------------------------------------------
create table if not exists public.developer_documents (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developers(id) on delete cascade,
  kind text not null default 'other' check (kind in ('cv', 'professional', 'other')),
  name text,
  url text,
  created_at timestamptz not null default now()
);

create index if not exists developer_documents_developer_idx on public.developer_documents (developer_id);

alter table public.developer_documents enable row level security;

drop policy if exists developer_documents_select_own on public.developer_documents;
create policy developer_documents_select_own on public.developer_documents
  for select using (developer_id = auth.uid());

-- ------------------------------------------------------------
-- 6. developer_links : GitHub, LinkedIn, autres liens
-- ------------------------------------------------------------
create table if not exists public.developer_links (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developers(id) on delete cascade,
  kind text not null default 'other' check (kind in ('github', 'linkedin', 'other')),
  label text,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists developer_links_developer_idx on public.developer_links (developer_id);

alter table public.developer_links enable row level security;

drop policy if exists developer_links_select_own on public.developer_links;
create policy developer_links_select_own on public.developer_links
  for select using (developer_id = auth.uid());

-- ------------------------------------------------------------
-- 7. developer_applications : dossiers d'inscription (historique)
-- ------------------------------------------------------------
create table if not exists public.developer_applications (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developers(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'changes_requested')),
  admin_message text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now()
);

create index if not exists developer_applications_developer_idx on public.developer_applications (developer_id, submitted_at desc);

-- Une seule inscription en attente à la fois.
create unique index if not exists developer_applications_pending_uidx
  on public.developer_applications (developer_id)
  where status = 'pending';

alter table public.developer_applications enable row level security;

drop policy if exists developer_applications_select_own on public.developer_applications;
create policy developer_applications_select_own on public.developer_applications
  for select using (developer_id = auth.uid());

-- ------------------------------------------------------------
-- 8. verification_requests : demandes de vérification payante
--    payment_status  : pending → confirmed → (paid)
--    verification_status : pending → verified | rejected
-- ------------------------------------------------------------
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developers(id) on delete cascade,
  amount_fcfa integer not null check (amount_fcfa > 0),
  method text not null default 'wave' check (method in ('wave', 'max_it')),
  provider text default 'wave',
  provider_session_id text,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'confirmed', 'failed', 'cancelled')),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  paid_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists verification_requests_developer_idx on public.verification_requests (developer_id, created_at desc);

-- Une seule vérification en cours par développeur (tant que la
-- demande n'est ni approuvée ni refusée). Un refus libère la main.
create unique index if not exists verification_requests_active_uidx
  on public.verification_requests (developer_id)
  where verification_status = 'pending';

alter table public.verification_requests enable row level security;

drop policy if exists verification_requests_select_own on public.verification_requests;
create policy verification_requests_select_own on public.verification_requests
  for select using (developer_id = auth.uid());

drop policy if exists verification_requests_insert_own on public.verification_requests;
create policy verification_requests_insert_own on public.verification_requests
  for insert with check (developer_id = auth.uid());

-- Aucun update/delete côté utilisateur : validations admin / webhook uniquement.

-- ------------------------------------------------------------
-- 9. payments : journal de paiement (vérification, tokens…)
-- ------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developers(id) on delete cascade,
  kind text not null default 'verification' check (kind in ('verification', 'tokens', 'other')),
  method text not null,
  amount_fcfa integer not null check (amount_fcfa > 0),
  currency text not null default 'XOF',
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'failed', 'cancelled')),
  provider text,
  provider_session_id text,
  entity_type text,
  entity_id uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payments_developer_idx on public.payments (developer_id, created_at desc);
create index if not exists payments_entity_idx on public.payments (entity_type, entity_id);

alter table public.payments enable row level security;

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select using (developer_id = auth.uid());

drop policy if exists payments_insert_own on public.payments;
create policy payments_insert_own on public.payments
  for insert with check (developer_id = auth.uid());

-- ------------------------------------------------------------
-- 10. admin_actions : journal d'activité de l'administration
-- ------------------------------------------------------------
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  message text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);

alter table public.admin_actions enable row level security;

-- ------------------------------------------------------------
-- 11. app_settings : configuration (prix de la vérification…)
-- ------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Prix par défaut de la vérification de profil (modifiable en admin).
insert into public.app_settings (key, value)
values ('verification_price_fcfa', '5000'::jsonb)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

-- ------------------------------------------------------------
-- 12. handle_new_user : branche développeur enrichie (étape 1),
--     branche client intégralement conservée (0013). Un développeur
--     est TOUJOURS créé en statut 'pending' : l'admin valide
--     manuellement avant activation. Jamais d'auto-activation.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := new.raw_user_meta_data;
  v_role text := coalesce(v_meta ->> 'role', 'developer');
  v_first text := nullif(btrim(coalesce(v_meta ->> 'first_name', '')), '');
  v_last text := nullif(btrim(coalesce(v_meta ->> 'last_name', '')), '');
  v_full text := nullif(btrim(coalesce(v_meta ->> 'full_name', '')), '');
  v_username text := nullif(btrim(coalesce(v_meta ->> 'username', '')), '');
  v_company text := nullif(btrim(coalesce(v_meta ->> 'company_name', '')), '');
  v_contact text := nullif(btrim(coalesce(v_meta ->> 'contact_name', '')), '');
begin
  if v_role = 'client' then
    insert into public.developers (id, full_name, whatsapp, status)
    values (new.id, v_full, nullif(btrim(coalesce(v_meta ->> 'whatsapp', '')), ''), 'suspended');

    insert into public.client_profiles (id, company_name, contact_name, phone, city)
    values (
      new.id,
      v_company,
      coalesce(v_contact, v_full),
      nullif(btrim(coalesce(v_meta ->> 'whatsapp', '')), ''),
      nullif(btrim(coalesce(v_meta ->> 'city', '')), '')
    );

    insert into public.user_roles (user_id, role)
    values (new.id, 'client');
  else
    if v_full is null and (v_first is not null or v_last is not null) then
      v_full := nullif(btrim(concat(coalesce(v_first, ''), ' ', coalesce(v_last, ''))), '');
    end if;

    if v_username is not null
       and v_username !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      v_username := null; -- le front valide ; ici on ne fait jamais échouer la création.
    end if;

    insert into public.developers (
      id, first_name, last_name, full_name, username,
      address, city, country, phone, whatsapp, skills,
      status
    )
    values (
      new.id,
      v_first,
      v_last,
      v_full,
      v_username,
      nullif(btrim(coalesce(v_meta ->> 'address', '')), ''),
      nullif(btrim(coalesce(v_meta ->> 'city', '')), ''),
      nullif(btrim(coalesce(v_meta ->> 'country', '')), ''),
      nullif(btrim(coalesce(v_meta ->> 'phone', '')), ''),
      nullif(btrim(coalesce(v_meta ->> 'whatsapp', '')), ''),
      case
        when jsonb_typeof(v_meta -> 'skills') = 'array'
          then (
            select coalesce(array_agg(v), '{}'::text[])
            from jsonb_array_elements_text(v_meta -> 'skills') as v
          )
        when v_meta ? 'skills'
          then array[nullif(v_meta ->> 'skills', '')]
        else null
      end,
      'pending'
    );

    insert into public.user_roles (user_id, role)
    values (new.id, 'developer');
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 13. Protection des colonnes gérées : un développeur ne peut
--     JAMAIS s'auto-valider ni s'octroyer le badge. Seule une
--     RESOUMISSION (pending depuis rejected/changes_requested)
--     est permise — jamais une activation.
-- -----------------------------------------------------------------
create or replace function public.developers_protect_managed_cols()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
begin
  if v_role <> 'service_role' and not public.is_admin() then
    if new.status = 'pending' and old.status in ('pending', 'changes_requested', 'rejected') then
      null; -- resoumission légitime (jamais une auto-activation)
    else
      new.status := old.status;
      new.is_verified := old.is_verified;
    end if;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 14. Gating : un compte actif OU vérifié peut débloquer des
--     briefs / acheter des Tokens.
-- ------------------------------------------------------------
create or replace function public.unlock_and_start_chat(
  p_request_id uuid,
  p_initial_message text,
  p_estimated_price integer,
  p_estimated_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_dev public.developers%rowtype;
  v_req public.requests%rowtype;
  v_balance integer;
  v_conv uuid;
  v_first boolean := false;
  v_demo boolean := false;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour débloquer un contact.' using errcode = 'TLNAU';
  end if;

  select * into v_dev from public.developers where id = v_user_id;
  if v_dev.id is null then
    raise exception 'Profil développeur requis.' using errcode = 'TLNOD';
  end if;
  if v_dev.status not in ('active', 'verified') then
    if v_dev.status = 'pending' then
      raise exception 'Votre compte développeur est en attente de validation.' using errcode = 'TLPEN';
    end if;
    raise exception 'Votre compte développeur ne permet pas de débloquer des contacts.' using errcode = 'TLRJC';
  end if;

  select * into v_req from public.requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'Ce brief n''existe pas.' using errcode = 'TLNOR';
  end if;
  if v_req.status <> 'ouvert' then
    raise exception 'Ce brief n''est plus disponible.' using errcode = 'TLCLO';
  end if;

  v_demo := coalesce(v_req.demo, false);

  select c.id into v_conv
    from public.conversations c
   where c.request_id = p_request_id and c.developer_id = v_user_id;

  if v_conv is null then
    if v_req.current_unlocks_count >= v_req.max_unlocks then
      raise exception 'Ce brief a déjà atteint le nombre maximal de développeurs en contact.' using errcode = 'TLLIM';
    end if;

    if exists (
      select 1 from public.unlocks
      where developer_id = v_user_id and request_id = p_request_id
    ) then
      null;
    else
      if not v_demo then
        select coalesce(sum(t.amount), 0)::integer into v_balance
          from public.token_transactions t
          where t.developer_id = v_user_id;

        if v_balance < 1 then
          raise exception 'Tokens insuffisants. Rechargez vos Tokens.' using errcode = 'TLLOW';
        end if;

        perform 1 from public.developers where id = v_user_id for update;

        insert into public.token_transactions (developer_id, amount, type, request_id)
        values (v_user_id, -1, 'unlock', p_request_id);
      end if;

      insert into public.unlocks (developer_id, request_id)
      values (v_user_id, p_request_id);

      update public.requests
         set current_unlocks_count = current_unlocks_count + 1
       where id = p_request_id;

      v_first := true;
    end if;

    insert into public.conversations (request_id, developer_id, client_id)
    values (p_request_id, v_user_id, v_req.client_id)
    on conflict (request_id, developer_id) do nothing
    returning id into v_conv;

    if v_conv is null then
      select c.id into v_conv
        from public.conversations c
       where c.request_id = p_request_id and c.developer_id = v_user_id;
    end if;
  end if;

  if nullif(btrim(coalesce(p_initial_message, '')), '') is not null then
    insert into public.messages (
      conversation_id, sender_id, content, message_type, metadata
    ) values (
      v_conv,
      v_user_id,
      btrim(p_initial_message),
      'text',
      jsonb_build_object(
        'kind', 'initial_proposal',
        'estimated_price_fcfa', nullif(p_estimated_price, 0),
        'estimated_days', nullif(p_estimated_days, 0)
      )
    );

    update public.conversations
       set last_message_at = now()
     where id = v_conv;
  end if;

  return jsonb_build_object(
    'conversation_id', v_conv,
    'first_unlock', v_first,
    'demo', v_demo,
    'balance', (
      select coalesce(sum(t.amount), 0)::integer
      from public.token_transactions t
      where t.developer_id = v_user_id
    )
  );
end;
$$;

-- ------------------------------------------------------------
-- 15. Notifications : message standard pour l'activation et
--     le badge vérifié (compatible avec le parcours admin).
-- ------------------------------------------------------------
create or replace function public.notify_inapp_event()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_other uuid;
  v_req public.requests%rowtype;
begin
  if tg_table_name = 'unlocks' and tg_op = 'INSERT' then
    select r.client_id into v_other from public.requests r where r.id = new.request_id;
    if v_other is not null then
      select * into v_req from public.requests where id = new.request_id;
      perform public.notify_user(
        v_other,
        'unlock_received',
        'Un developpeur s''interesse a votre brief',
        'Un prestataire vient de debloquer votre brief pour vous contacter. Repondez-lui dans la messagerie.',
        '/conversations'
      );
    end if;
    return new;
  end if;

  if tg_table_name = 'messages' and tg_op = 'INSERT' then
    if new.sender_id is not null then
      select case
               when c.client_id = new.sender_id then c.developer_id
               else c.client_id
             end
        into v_other
        from public.conversations c
       where c.id = new.conversation_id;
      if v_other is not null then
        if not exists (
          select 1 from public.notifications n
          where n.user_id = v_other
            and n.entity_type = 'conversation'
            and n.entity_id = new.conversation_id
            and n.created_at > now() - interval '60 seconds'
        ) then
          perform public.notify_user(
            v_other,
            'new_message',
            'Nouveau message',
            left(coalesce(new.content, ''), 120),
            '/conversations/' || new.conversation_id::text,
            'conversation',
            new.conversation_id
          );
        end if;
      end if;
    end if;
    return new;
  end if;

  if tg_table_name = 'formal_offers' and tg_op = 'UPDATE' then
    if new.status = 'accepted' then
      perform public.notify_user(
        new.developer_id,
        'offer_accepted',
        'Votre devis a ete accepte',
        'Le client a accepte votre devis, une mission demarre.',
        '/conversations'
      );
    end if;
    return new;
  end if;

  if tg_table_name = 'reviews' and tg_op = 'INSERT' then
    perform public.notify_user(
      new.developer_id,
      'review_received',
      'Nouvelle evaluation',
      'Un client a note votre mission sur votre profil.',
      '/dashboard'
    );
    return new;
  end if;

  if tg_table_name = 'developers' and tg_op = 'UPDATE' then
    if old.status = 'pending' and new.status = 'active' then
      perform public.notify_user(
        new.id,
        'account_approved',
        'Votre compte TERANGA LABS est maintenant actif',
        'Vous pouvez accéder à votre dashboard et commencer à recevoir des opportunités correspondant à votre profil.',
        '/dashboard'
      );
    elsif old.status <> 'verified' and new.status = 'verified' then
      perform public.notify_user(
        new.id,
        'profile_verified',
        'Badge Vérifié obtenu',
        'Votre profil a été vérifié par TERANGA LABS. Le badge Vérifié est maintenant affiché à côté de votre nom.',
        '/dashboard'
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 16. RPC SITE — prix de la vérification
-- ------------------------------------------------------------
create or replace function public.get_verification_price()
returns integer
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(
    (select (value #>> '{}')::int from public.app_settings where key = 'verification_price_fcfa'),
    5000
  );
$$;

-- ------------------------------------------------------------
-- 17. RPC SITE — soumission de l'inscription (étape 2)
--     Valide, enregistre le profil professionnel et crée un
--     dossier d'application en attente. Ne JAMAIS activer seul.
-- ------------------------------------------------------------
create or replace function public.submit_developer_application(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_dev public.developers%rowtype;
  v_title text := nullif(btrim(coalesce(p_payload ->> 'professional_title', '')), '');
  v_specialty text := nullif(btrim(coalesce(p_payload ->> 'main_specialty', '')), '');
  v_bio text := nullif(btrim(coalesce(p_payload ->> 'bio', '')), '');
  v_avatar text := nullif(btrim(coalesce(p_payload ->> 'avatar_url', '')), '');
  v_experience_level text := p_payload ->> 'experience_level';
  v_experience_years integer := (p_payload ->> 'experience_years')::int;
  v_projects_estimate integer := (p_payload ->> 'projects_estimate')::int;
  v_availability text := p_payload ->> 'availability';
  v_rate_min integer := (p_payload ->> 'rate_min_fcfa')::int;
  v_rate_max integer := (p_payload ->> 'rate_max_fcfa')::int;
  v_terms boolean := coalesce((p_payload ->> 'terms_accepted')::boolean, false);
  v_applications integer;
begin
  if v_user is null then
    raise exception 'Connectez-vous pour envoyer votre inscription.' using errcode = 'TLNAU';
  end if;

  select * into v_dev from public.developers where id = v_user;
  if v_dev.id is null then
    raise exception 'Profil développeur requis.' using errcode = 'TLNOD';
  end if;

  if v_dev.status in ('active', 'verified', 'suspended', 'verification_pending') then
    raise exception 'Votre compte est déjà actif, vérifié ou en cours de vérification : aucune nouvelle inscription n''est nécessaire.' using errcode = 'TLRJC';
  end if;

  -- Validations.
  if v_title is null or length(v_title) > 120 then
    raise exception 'Le titre professionnel est requis (120 caractères max).' using errcode = 'TLBAD';
  end if;
  if v_specialty is null or length(v_specialty) > 120 then
    raise exception 'La spécialité principale est requise.' using errcode = 'TLBAD';
  end if;
  if v_bio is not null and length(v_bio) > 2000 then
    raise exception 'Présentation trop longue (2000 caractères max).' using errcode = 'TLBAD';
  end if;
  if v_experience_level not in ('debutant', 'intermediaire', 'avance', 'expert') then
    raise exception 'Niveau d''expérience invalide.' using errcode = 'TLBAD';
  end if;
  if v_experience_years is null or v_experience_years < 0 or v_experience_years > 100 then
    raise exception 'Années d''expérience invalides.' using errcode = 'TLBAD';
  end if;
  if v_projects_estimate is null or v_projects_estimate < 0 then
    raise exception 'Nombre de projets réalisés invalide.' using errcode = 'TLBAD';
  end if;
  if v_availability not in ('available_now', 'available_soon', 'on_mission') then
    raise exception 'Disponibilité invalide.' using errcode = 'TLBAD';
  end if;
  if v_rate_min is null or v_rate_min < 0 or v_rate_max is null or v_rate_max < v_rate_min then
    raise exception 'Tarification invalide (minimum ± maximum en FCFA).' using errcode = 'TLBAD';
  end if;
  if not v_terms then
    raise exception 'Vous devez accepter les conditions d''utilisation et certifier l''exactitude des informations.' using errcode = 'TLBAD';
  end if;
  if jsonb_typeof(p_payload -> 'services') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'services') = 0 then
    raise exception 'Sélectionnez au moins un service proposé.' using errcode = 'TLBAD';
  end if;
  if jsonb_typeof(p_payload -> 'skills') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'skills') = 0 then
    raise exception 'Sélectionnez au moins une compétence technique.' using errcode = 'TLBAD';
  end if;

  -- Une seule inscription en attente.
  select count(*) into v_applications
    from public.developer_applications
   where developer_id = v_user and status = 'pending';

  if v_applications > 0 then
    raise exception 'Votre inscription est déjà en cours d''examen.' using errcode = 'TLDUP';
  end if;

  -- Profil professionnel (upsert 1:1).
  insert into public.developer_profiles (
    developer_id, professional_title, main_specialty, availability,
    rate_min_fcfa, rate_max_fcfa, currency, projects_estimate,
    experience_level, terms_accepted_at, submitted_at, updated_at
  ) values (
    v_user, v_title, v_specialty, v_availability,
    v_rate_min, v_rate_max, 'FCFA', v_projects_estimate,
    v_experience_level, now(), now(), now()
  )
  on conflict (developer_id) do update
  set professional_title = excluded.professional_title,
      main_specialty = excluded.main_specialty,
      availability = excluded.availability,
      rate_min_fcfa = excluded.rate_min_fcfa,
      rate_max_fcfa = excluded.rate_max_fcfa,
      projects_estimate = excluded.projects_estimate,
      experience_level = excluded.experience_level,
      terms_accepted_at = excluded.terms_accepted_at,
      submitted_at = now(),
      updated_at = now();

  -- Fiche développeur (bio, avatar, compétences, expérience).
  -- La soumission (re)met le dossier en 'pending' devant l'admin :
  -- c'est le seul moment où la colonne gérée est modifiée par le
  -- développeur, et uniquement vers 'pending' (protection en 13).
  update public.developers
     set bio = coalesce(v_bio, bio),
         avatar_url = coalesce(v_avatar, avatar_url),
         skills = coalesce((
           select array_agg(v) from jsonb_array_elements_text(p_payload -> 'skills') v
         ), '{}'::text[]),
         experience_years = v_experience_years,
         rejection_reason = null,
         status = 'pending'
   where id = v_user;

  -- Services.
  delete from public.developer_services where developer_id = v_user;
  insert into public.developer_services (developer_id, service)
  select v_user, trim(v)
    from jsonb_array_elements_text(p_payload -> 'services') v
   where nullif(trim(v), '') is not null;

  -- Portfolio (remplacement propre).
  delete from public.developer_projects where developer_id = v_user;
  insert into public.developer_projects (
    developer_id, name, description, project_type, technologies, url, screenshots
  )
  select v_user,
         p ->> 'name',
         nullif(btrim(coalesce(p ->> 'description', '')), ''),
         nullif(btrim(coalesce(p ->> 'project_type', '')), ''),
         coalesce((
           select array_agg(x) from jsonb_array_elements_text(coalesce(p -> 'technologies', '[]'::jsonb)) x
         ), '{}'::text[]),
         nullif(btrim(coalesce(p ->> 'url', '')), ''),
         coalesce((
           select array_agg(x) from jsonb_array_elements_text(coalesce(p -> 'screenshots', '[]'::jsonb)) x
         ), '{}'::text[])
  from jsonb_array_elements(coalesce(p_payload -> 'projects', '[]'::jsonb)) p
  where nullif(btrim(coalesce(p ->> 'name', '')), '') is not null;

  -- Documents.
  delete from public.developer_documents where developer_id = v_user;
  insert into public.developer_documents (developer_id, kind, name, url)
  select v_user,
         case when d ->> 'kind' in ('cv', 'professional') then d ->> 'kind' else 'other' end,
         nullif(btrim(coalesce(d ->> 'name', '')), ''),
         nullif(btrim(coalesce(d ->> 'url', '')), '')
  from jsonb_array_elements(coalesce(p_payload -> 'documents', '[]'::jsonb)) d
  where nullif(btrim(coalesce(d ->> 'url', '')), '') is not null;

  -- Liens professionnels.
  delete from public.developer_links where developer_id = v_user;
  insert into public.developer_links (developer_id, kind, label, url)
  select v_user,
         case when l ->> 'kind' in ('github', 'linkedin') then l ->> 'kind' else 'other' end,
         nullif(btrim(coalesce(l ->> 'label', '')), ''),
         nullif(btrim(coalesce(l ->> 'url', '')), '')
  from jsonb_array_elements(coalesce(p_payload -> 'links', '[]'::jsonb)) l
  where nullif(btrim(coalesce(l ->> 'url', '')), '') is not null;

  -- Dossier d'application en attente.
  insert into public.developer_applications (developer_id, status)
  values (v_user, 'pending');

  return jsonb_build_object('ok', true, 'status', 'pending');
end;
$$;

-- ------------------------------------------------------------
-- 18. RPC SITE — lecture du dossier & du profil (préremplissage / statut)
-- ------------------------------------------------------------
create or replace function public.get_my_developer_application()
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_dev public.developers%rowtype;
  v_prof public.developer_profiles%rowtype;
  v_app public.developer_applications%rowtype;
begin
  if v_user is null then
    raise exception 'Connectez-vous.' using errcode = 'TLNAU';
  end if;

  select * into v_dev from public.developers where id = v_user;
  if v_dev.id is null then
    return null;
  end if;

  select * into v_prof from public.developer_profiles where developer_id = v_user;
  select * into v_app from public.developer_applications where developer_id = v_user order by submitted_at desc limit 1;

  return jsonb_build_object(
    'first_name', v_dev.first_name,
    'last_name', v_dev.last_name,
    'full_name', v_dev.full_name,
    'username', v_dev.username,
    'email', null,
    'address', v_dev.address,
    'city', v_dev.city,
    'country', v_dev.country,
    'phone', v_dev.phone,
    'whatsapp', v_dev.whatsapp,
    'avatar_url', v_dev.avatar_url,
    'bio', v_dev.bio,
    'skills', coalesce(v_dev.skills, '{}'::text[]),
    'status', v_dev.status,
    'is_verified', v_dev.is_verified,
    'rejection_reason', v_dev.rejection_reason,
    'created_at', v_dev.created_at,
    'professional_title', v_prof.professional_title,
    'main_specialty', v_prof.main_specialty,
    'availability', v_prof.availability,
    'rate_min_fcfa', v_prof.rate_min_fcfa,
    'rate_max_fcfa', v_prof.rate_max_fcfa,
    'projects_estimate', v_prof.projects_estimate,
    'experience_level', v_prof.experience_level,
    'services', coalesce((
      select jsonb_agg(s.service order by s.service)
      from public.developer_services s where s.developer_id = v_user
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'name', pr.name,
        'description', pr.description,
        'project_type', pr.project_type,
        'technologies', pr.technologies,
        'url', pr.url,
        'screenshots', pr.screenshots
      ) order by pr.created_at)
      from public.developer_projects pr where pr.developer_id = v_user
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'kind', d.kind, 'name', d.name, 'url', d.url
      ) order by d.created_at)
      from public.developer_documents d where d.developer_id = v_user
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'kind', l.kind, 'label', l.label, 'url', l.url
      ) order by l.created_at)
      from public.developer_links l where l.developer_id = v_user
    ), '[]'::jsonb),
    'application', case when v_app.id is null then null else jsonb_build_object(
      'id', v_app.id,
      'status', v_app.status,
      'admin_message', v_app.admin_message,
      'reviewed_at', v_app.reviewed_at,
      'submitted_at', v_app.submitted_at
    ) end
  );
end;
$$;

-- ------------------------------------------------------------
-- 19. RPC SITE — statut de la dernière vérification
-- ------------------------------------------------------------
create or replace function public.get_my_verification_status()
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select (
    select jsonb_build_object(
      'id', v.id,
      'amount_fcfa', v.amount_fcfa,
      'method', v.method,
      'payment_status', v.payment_status,
      'verification_status', v.verification_status,
      'paid_at', v.paid_at,
      'rejection_reason', v.rejection_reason,
      'created_at', v.created_at
    )
    from public.verification_requests v
    where v.developer_id = auth.uid()
    order by v.created_at desc
    limit 1
  );
$$;

-- ------------------------------------------------------------
-- 20. RPC ADMIN — liste des développeurs (dossiers + profil)
-- ------------------------------------------------------------
create or replace function public.admin_list_developer_applications()
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return (
    select coalesce(
      jsonb_agg(jsonb_build_object(
        'id', d.id,
        'first_name', d.first_name,
        'last_name', d.last_name,
        'full_name', d.full_name,
        'username', d.username,
        'email', au.email,
        'address', d.address,
        'city', d.city,
        'country', d.country,
        'phone', d.phone,
        'whatsapp', d.whatsapp,
        'avatar_url', d.avatar_url,
        'bio', d.bio,
        'skills', coalesce(d.skills, '{}'::text[]),
        'experience_years', d.experience_years,
        'status', d.status,
        'is_verified', d.is_verified,
        'rejection_reason', d.rejection_reason,
        'created_at', d.created_at,
        'professional_title', p.professional_title,
        'main_specialty', p.main_specialty,
        'availability', p.availability,
        'rate_min_fcfa', p.rate_min_fcfa,
        'rate_max_fcfa', p.rate_max_fcfa,
        'experience_level', p.experience_level,
        'projects_estimate', p.projects_estimate,
        'services', coalesce((
          select jsonb_agg(s.service order by s.service)
          from public.developer_services s where s.developer_id = d.id
        ), '[]'::jsonb),
        'projects_count', (
          select count(*)::integer from public.developer_projects pr where pr.developer_id = d.id
        ),
        'applications_count', (
          select count(*)::integer from public.developer_applications a where a.developer_id = d.id
        ),
        'last_application', (
          select jsonb_build_object(
            'id', a.id, 'status', a.status,
            'admin_message', a.admin_message,
            'reviewed_at', a.reviewed_at,
            'submitted_at', a.submitted_at
          )
          from public.developer_applications a
          where a.developer_id = d.id
          order by a.submitted_at desc limit 1
        )
      ) order by d.created_at desc),
      '[]'::jsonb
    )
    from public.developers d
    left join public.developer_profiles p on p.developer_id = d.id
    left join auth.users au on au.id = d.id
  );
end;
$$;

-- ------------------------------------------------------------
-- 21. RPC ADMIN — fiche complète d'un développeur
-- ------------------------------------------------------------
create or replace function public.admin_get_developer_application(p_developer uuid)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  select jsonb_build_object(
    'id', d.id,
    'first_name', d.first_name,
    'last_name', d.last_name,
    'full_name', d.full_name,
    'username', d.username,
    'email', au.email,
    'address', d.address,
    'city', d.city,
    'country', d.country,
    'phone', d.phone,
    'whatsapp', d.whatsapp,
    'avatar_url', d.avatar_url,
    'bio', d.bio,
    'skills', coalesce(d.skills, '{}'::text[]),
    'experience_years', d.experience_years,
    'status', d.status,
    'is_verified', d.is_verified,
    'rejection_reason', d.rejection_reason,
    'created_at', d.created_at,
    'profile', jsonb_build_object(
      'professional_title', p.professional_title,
      'main_specialty', p.main_specialty,
      'availability', p.availability,
      'rate_min_fcfa', p.rate_min_fcfa,
      'rate_max_fcfa', p.rate_max_fcfa,
      'projects_estimate', p.projects_estimate,
      'experience_level', p.experience_level,
      'terms_accepted_at', p.terms_accepted_at,
      'submitted_at', p.submitted_at
    ),
    'services', coalesce((
      select jsonb_agg(s.service order by s.service)
      from public.developer_services s where s.developer_id = d.id
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'name', pr.name, 'description', pr.description,
        'project_type', pr.project_type, 'technologies', pr.technologies,
        'url', pr.url, 'screenshots', pr.screenshots
      ) order by pr.created_at)
      from public.developer_projects pr where pr.developer_id = d.id
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind, 'name', x.name, 'url', x.url) order by x.created_at)
      from public.developer_documents x where x.developer_id = d.id
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind, 'label', x.label, 'url', x.url) order by x.created_at)
      from public.developer_links x where x.developer_id = d.id
    ), '[]'::jsonb),
    'applications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'status', a.status, 'admin_message', a.admin_message,
        'reviewed_at', a.reviewed_at, 'submitted_at', a.submitted_at
      ) order by a.submitted_at desc)
      from public.developer_applications a where a.developer_id = d.id
    ), '[]'::jsonb),
    'verifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'amount_fcfa', v.amount_fcfa, 'method', v.method,
        'payment_status', v.payment_status, 'verification_status', v.verification_status,
        'paid_at', v.paid_at, 'rejection_reason', v.rejection_reason, 'created_at', v.created_at
      ) order by v.created_at desc)
      from public.verification_requests v where v.developer_id = d.id
    ), '[]'::jsonb)
  ) into v_result
  from public.developers d
  left join public.developer_profiles p on p.developer_id = d.id
  left join auth.users au on au.id = d.id
  where d.id = p_developer;

  if v_result is null or v_result ->> 'id' is null then
    raise exception 'Développeur introuvable.' using errcode = 'TLNOD';
  end if;

  return v_result;
end;
$$;

-- ------------------------------------------------------------
-- 22. RPC ADMIN — approuver / refuser / demander des modifications
-- ------------------------------------------------------------
create or replace function public.admin_review_developer(
  p_developer uuid,
  p_action text,
  p_message text default null
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_dev public.developers%rowtype;
  v_app public.developer_applications%rowtype;
  v_new_status text;
  v_app_status text;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  if p_action not in ('approve', 'reject', 'request_changes') then
    raise exception 'Action invalide.' using errcode = 'TLBAD';
  end if;

  if (p_action = 'request_changes' or p_action = 'reject') and v_message is null then
    raise exception 'Précisez un message expliquant la décision.' using errcode = 'TLBAD';
  end if;

  select * into v_dev from public.developers where id = p_developer;
  if v_dev.id is null then
    raise exception 'Développeur introuvable.' using errcode = 'TLNOD';
  end if;

  v_new_status := case p_action
    when 'approve' then 'active'
    when 'reject' then 'rejected'
    else 'changes_requested'
  end;
  v_app_status := case p_action
    when 'approve' then 'approved'
    when 'reject' then 'rejected'
    else 'changes_requested'
  end;

  update public.developers
     set status = v_new_status,
         rejection_reason = case when p_action = 'reject' then v_message else null end
   where id = p_developer;

  select * into v_app
    from public.developer_applications
   where developer_id = p_developer
   order by submitted_at desc
   limit 1;

  if v_app.id is not null then
    update public.developer_applications
       set status = v_app_status,
           admin_message = v_message,
           reviewed_by = auth.uid(),
           reviewed_at = now()
     where id = v_app.id;
  else
    insert into public.developer_applications (developer_id, status, admin_message, reviewed_by, reviewed_at)
    values (p_developer, v_app_status, v_message, auth.uid(), now());
  end if;

  -- Notifications (l'activation pending→active est gérée par le trigger).
  if not (p_action = 'approve' and v_dev.status = 'pending') then
    if p_action = 'approve' then
      perform public.notify_user(
        p_developer, 'account_approved',
        'Votre compte TERANGA LABS est maintenant actif',
        'Vous pouvez accéder à votre dashboard et commencer à recevoir des opportunités correspondant à votre profil.',
        '/dashboard'
      );
    elsif p_action = 'reject' then
      perform public.notify_user(
        p_developer, 'application_rejected',
        'Votre inscription a été refusée',
        coalesce(v_message, 'Votre dossier ne répond pas aux critères de TERANGA LABS.'),
        '/inscription-developpeur'
      );
    else
      perform public.notify_user(
        p_developer, 'changes_requested',
        'Des modifications sont demandées sur votre dossier',
        coalesce(v_message, 'Merci de mettre à jour votre profil pour valider votre inscription.'),
        '/inscription-developpeur'
      );
    end if;
  end if;

  insert into public.admin_actions (admin_id, entity_type, entity_id, action, message)
  values (auth.uid(), 'developer', p_developer, p_action, v_message);

  return jsonb_build_object(
    'developer_id', p_developer,
    'status', v_new_status,
    'application_status', v_app_status
  );
end;
$$;

-- ------------------------------------------------------------
-- 23. RPC ADMIN / WEBHOOK — confirmer le paiement de vérification
-- ------------------------------------------------------------
create or replace function public.admin_confirm_verification_payment(p_verification uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_req public.verification_requests%rowtype;
begin
  if not public.is_admin()
     and current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  select * into v_req from public.verification_requests where id = p_verification;
  if v_req.id is null then
    raise exception 'Demande de vérification introuvable.' using errcode = 'TLNOR';
  end if;

  if v_req.payment_status = 'confirmed' then
    return jsonb_build_object('verification_id', p_verification, 'payment_status', 'confirmed', 'already', true);
  end if;

  if v_req.payment_status <> 'pending' then
    raise exception 'Paiement non concerné par une confirmation.' using errcode = 'TLDUP';
  end if;

  update public.verification_requests
     set payment_status = 'confirmed',
         paid_at = now()
   where id = p_verification;

  update public.payments
     set status = 'confirmed', confirmed_at = now()
   where entity_type = 'verification_request'
     and entity_id = p_verification;

  perform public.notify_user(
    v_req.developer_id, 'payment_confirmed',
    'Paiement de la vérification confirmé',
    'Merci ! Votre profil est maintenant en cours de vérification par l''équipe TERANGA LABS.',
    '/dashboard'
  );

  insert into public.admin_actions (admin_id, entity_type, entity_id, action, message)
  values (
    case when public.is_admin() then auth.uid() else null end,
    'verification_request', p_verification, 'confirm_payment', 'Paiement confirmé'
  );

  return jsonb_build_object('verification_id', p_verification, 'payment_status', 'confirmed');
end;
$$;

-- ------------------------------------------------------------
-- 24. RPC ADMIN — approuver / refuser la vérification
-- ------------------------------------------------------------
create or replace function public.admin_review_verification(
  p_verification uuid,
  p_approve boolean,
  p_message text default null
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_req public.verification_requests%rowtype;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  select * into v_req from public.verification_requests where id = p_verification;
  if v_req.id is null then
    raise exception 'Demande de vérification introuvable.' using errcode = 'TLNOR';
  end if;

  if v_req.payment_status <> 'confirmed' then
    raise exception 'Le paiement doit être confirmé avant l''examen de la vérification.' using errcode = 'TLPEN';
  end if;

  if not p_approve and v_message is null then
    raise exception 'Précisez le motif du refus.' using errcode = 'TLBAD';
  end if;

  if p_approve then
    update public.verification_requests
       set verification_status = 'verified',
           reviewed_by = auth.uid(),
           reviewed_at = now()
     where id = p_verification;

    -- Le trigger envoie la notification « Badge Vérifié obtenu ».
    update public.developers
       set is_verified = true,
           status = 'verified'
     where id = v_req.developer_id;
  else
    update public.verification_requests
       set verification_status = 'rejected',
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           rejection_reason = v_message
     where id = p_verification;

    perform public.notify_user(
      v_req.developer_id, 'verification_rejected',
      'Vérification de profil refusée',
      v_message,
      '/verification'
    );
  end if;

  insert into public.admin_actions (admin_id, entity_type, entity_id, action, message)
  values (auth.uid(), 'verification_request', p_verification,
          case when p_approve then 'approve_verification' else 'reject_verification' end,
          v_message);

  return jsonb_build_object(
    'verification_id', p_verification,
    'verification_status', case when p_approve then 'verified' else 'rejected' end
  );
end;
$$;

-- ------------------------------------------------------------
-- 25. RPC ADMIN — prix de la vérification & liste des demandes
-- ------------------------------------------------------------
create or replace function public.admin_set_verification_price(p_price_fcfa integer)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;
  if p_price_fcfa is null or p_price_fcfa <= 0 or p_price_fcfa > 100000000 then
    raise exception 'Prix invalide.' using errcode = 'TLBAD';
  end if;

  insert into public.app_settings (key, value, updated_at)
  values ('verification_price_fcfa', to_jsonb(p_price_fcfa), now())
  on conflict (key) do update
  set value = excluded.value, updated_at = now();

  insert into public.admin_actions (admin_id, entity_type, entity_id, action, message)
  values (auth.uid(), 'settings', null, 'set_verification_price', ('Prix vérification : ' || p_price_fcfa || ' FCFA'));

  return jsonb_build_object('price_fcfa', p_price_fcfa);
end;
$$;

create or replace function public.admin_list_verifications()
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return (
    select coalesce(
      jsonb_agg(jsonb_build_object(
        'id', v.id,
        'developer_id', v.developer_id,
        'developer_name', coalesce(d.full_name, au.email),
        'developer_email', au.email,
        'developer_city', d.city,
        'avatar_url', d.avatar_url,
        'amount_fcfa', v.amount_fcfa,
        'method', v.method,
        'provider_session_id', v.provider_session_id,
        'payment_status', v.payment_status,
        'verification_status', v.verification_status,
        'paid_at', v.paid_at,
        'rejection_reason', v.rejection_reason,
        'created_at', v.created_at
      ) order by v.created_at desc),
      '[]'::jsonb
    )
    from public.verification_requests v
    join public.developers d on d.id = v.developer_id
    left join auth.users au on au.id = v.developer_id
  );
end;
$$;

-- ------------------------------------------------------------
-- 26. RPC ADMIN — journal d'activité & alertes
-- ------------------------------------------------------------
create or replace function public.admin_list_admin_actions(p_limit integer default 100)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return (
    select coalesce(
      jsonb_agg(jsonb_build_object(
        'id', a.id,
        'admin_email', au.email,
        'entity_type', a.entity_type,
        'entity_id', a.entity_id,
        'action', a.action,
        'message', a.message,
        'created_at', a.created_at
      ) order by a.created_at desc),
      '[]'::jsonb
    )
    from public.admin_actions a
    left join auth.users au on au.id = a.admin_id
    limit greatest(0, least(coalesce(p_limit, 100), 500))
  );
end;
$$;

create or replace function public.admin_alerts()
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return jsonb_build_object(
    'pending_applications', (
      select count(*)::integer from public.developers where status = 'pending'
    ),
    'changes_requested', (
      select count(*)::integer from public.developers where status = 'changes_requested'
    ),
    'pending_verifications', (
      select count(*)::integer from public.verification_requests
      where payment_status = 'confirmed' and verification_status = 'pending'
    ),
    'pending_payments', (
      select count(*)::integer from public.verification_requests
      where payment_status = 'pending'
    ),
    'verification_price_fcfa', public.get_verification_price()
  );
end;
$$;

-- ------------------------------------------------------------
-- 27. Cohérence des fonctions existantes
--   a) get_public_developer_profile : un compte VÉRIFIÉ est visible
--      sur la vitrine publique (/dev/[username]). Champs pro ajoutés.
--   b) list_developers_for_brief : les comptes vérifiés reçoivent
--      aussi les opportunités correspondantes.
--   c) set_developer_status : nouveaux états autorisés (admin).
-- ------------------------------------------------------------
create or replace function public.get_public_developer_profile(p_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_identifier text := nullif(btrim(p_identifier), '');
  v_dev public.developers%rowtype;
  v_prof public.developer_profiles%rowtype;
  v_response_minutes numeric;
  v_response_rate numeric;
begin
  if v_identifier is null then
    raise exception 'Profil introuvable.' using errcode = 'TLNOK';
  end if;

  if v_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_dev
      from public.developers
     where id = v_identifier::uuid
       and status in ('active', 'verified');
  else
    select * into v_dev
      from public.developers
     where username = lower(v_identifier)
       and status in ('active', 'verified');
  end if;

  if v_dev.id is null then
    raise exception 'Profil introuvable.' using errcode = 'TLNOK';
  end if;

  select * into v_prof from public.developer_profiles where developer_id = v_dev.id;

  select round(coalesce(avg(gap_minutes), 0))::numeric
    into v_response_minutes
    from (
      select
        c.id,
        c.created_at,
        (
          select extract(epoch from min(m.created_at) - c.created_at) / 60
            from public.messages m
           where m.conversation_id = c.id
             and m.sender_id = v_dev.id
             and m.created_at > c.created_at
        ) as gap_minutes
        from public.messages c
        join public.unlocks u on u.id = c.conversation_id
       where c.conversation_id in (
               select id from public.unlocks where developer_id = v_dev.id
             )
         and c.sender_id <> v_dev.id
    ) gaps
   where gaps.gap_minutes is not null;

  select round(
           count(distinct case when dev_replied then u.id end)::numeric
           / nullif(count(distinct case when client_wrote then u.id end), 0)::numeric
           * 100
         )::numeric
    into v_response_rate
    from (
      select
        u.id,
        bool_or(m.sender_id = u.developer_id) as dev_replied,
        bool_or(m.sender_id <> u.developer_id) as client_wrote
        from public.unlocks u
        join public.messages m on m.conversation_id = u.id
       where u.developer_id = v_dev.id
       group by u.id
    ) u;

  return jsonb_build_object(
    'id', v_dev.id,
    'username', v_dev.username,
    'first_name', v_dev.first_name,
    'last_name', v_dev.last_name,
    'full_name', v_dev.full_name,
    'country', v_dev.country,
    'bio', v_dev.bio,
    'avatar_url', v_dev.avatar_url,
    'city', v_dev.city,
    'whatsapp', v_dev.whatsapp,
    'skills', coalesce(to_jsonb(v_dev.skills), '[]'::jsonb),
    'experience_years', v_dev.experience_years,
    'is_verified', v_dev.is_verified,
    'created_at', v_dev.created_at,
    'professional_title', v_prof.professional_title,
    'main_specialty', v_prof.main_specialty,
    'availability', v_prof.availability,
    'rate_min_fcfa', v_prof.rate_min_fcfa,
    'rate_max_fcfa', v_prof.rate_max_fcfa,
    'services', coalesce((
      select jsonb_agg(s.service order by s.service)
      from public.developer_services s where s.developer_id = v_dev.id
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'name', pr.name, 'description', pr.description,
        'project_type', pr.project_type, 'technologies', pr.technologies,
        'url', pr.url, 'screenshots', pr.screenshots
      ) order by pr.created_at)
      from public.developer_projects pr where pr.developer_id = v_dev.id
    ), '[]'::jsonb),
    'avg_response_minutes', v_response_minutes,
    'response_rate', v_response_rate,
    'portfolio_links', coalesce(v_dev.portfolio_links, '[]'::jsonb),
    'projects_count', (
      select count(*)::integer from (
        select 1 from public.unlocks where developer_id = v_dev.id
        union all
        select 1 from public.developer_projects where developer_id = v_dev.id
      ) x
    ),
    'completed_projects_count', v_dev.completed_projects_count,
    'review_count', v_dev.reviews_count,
    'review_average', round(coalesce(v_dev.rating_avg, 0), 1)::numeric,
    'reputation_score', v_dev.reputation_score,
    'reputation_level', v_dev.reputation_level,
    'penalty', v_dev.penalty,
    'reviews', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'rating', r.rating,
          'comment', r.comment,
          'request_name', req.client_name,
          'created_at', r.created_at
        )
        order by r.created_at desc
      )
      from public.reviews r
      left join public.requests req on req.id = r.request_id
      where r.developer_id = v_dev.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.list_developers_for_brief(
  p_city text,
  p_keywords text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_city text := coalesce(nullif(btrim(p_city), ''), null);
  v_keywords text[] := coalesce(p_keywords, '{}'::text[]);
  v_rows jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'full_name', d.full_name,
        'whatsapp', d.whatsapp,
        'city', d.city,
        'skills', d.skills,
        'email', du.email
      )
      order by d.created_at asc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.developers d
  left join auth.users du on du.id = d.id
  where d.status in ('active', 'verified')
    and d.notifications_enabled = true
    and d.whatsapp is not null
    and (
      (v_city is not null and d.city is not null and d.city = v_city)
      or (cardinality(v_keywords) > 0 and d.skills && v_keywords)
    );

  return v_rows;
end;
$$;

create or replace function public.set_developer_status(
  p_developer uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  if p_status not in ('pending', 'active', 'verified', 'verification_pending', 'changes_requested', 'rejected', 'suspended') then
    raise exception 'Statut invalide.' using errcode = 'TLBAD';
  end if;

  if not exists (select 1 from public.developers where id = p_developer) then
    raise exception 'Développeur introuvable.' using errcode = 'TLNOD';
  end if;

  update public.developers set status = p_status where id = p_developer;
  return jsonb_build_object('developer_id', p_developer, 'status', p_status);
end;
$$;

create or replace function public.create_token_order(p_package_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_dev public.developers%rowtype;
  v_pkg public.token_packages%rowtype;
  v_order public.token_orders%rowtype;
begin
  if v_user is null then
    raise exception 'Connectez-vous pour commander.' using errcode = 'TLNAU';
  end if;

  select * into v_dev from public.developers where id = v_user;
  if v_dev.id is null then
    raise exception 'Profil développeur requis.' using errcode = 'TLNOD';
  end if;
  if v_dev.status not in ('active', 'verified') then
    if v_dev.status in ('pending', 'verification_pending') then
      raise exception 'Votre compte développeur est en attente de validation.' using errcode = 'TLPEN';
    end if;
    raise exception 'Votre compte développeur ne permet pas d''acheter des Tokens.' using errcode = 'TLRJC';
  end if;

  select * into v_pkg from public.token_packages where id = p_package_id;
  if v_pkg.id is null then
    raise exception 'Pack introuvable.' using errcode = 'TLNOP';
  end if;

  insert into public.token_orders (developer_id, package_id, package_name, tokens, price_fcfa)
  values (v_user, v_pkg.id, v_pkg.name, v_pkg.tokens, v_pkg.price_fcfa)
  returning * into v_order;

  return jsonb_build_object(
    'order_id', v_order.id,
    'package_name', v_order.package_name,
    'tokens', v_order.tokens,
    'price_fcfa', v_order.price_fcfa,
    'status', v_order.status,
    'created_at', v_order.created_at
  );
end;
$$;

-- ------------------------------------------------------------
-- 28. Privilèges
-- ------------------------------------------------------------
grant execute on function public.get_verification_price() to anon, authenticated;
grant execute on function public.submit_developer_application(jsonb) to authenticated;
grant execute on function public.get_my_developer_application() to authenticated;
grant execute on function public.get_my_verification_status() to authenticated;

grant execute on function public.is_phone_taken(text) to anon, authenticated;

grant execute on function public.admin_list_developer_applications() to authenticated;
grant execute on function public.admin_get_developer_application(uuid) to authenticated;
grant execute on function public.admin_review_developer(uuid, text, text) to authenticated;
grant execute on function public.admin_confirm_verification_payment(uuid) to authenticated;
grant execute on function public.admin_review_verification(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_verification_price(integer) to authenticated;
grant execute on function public.admin_list_verifications() to authenticated;
grant execute on function public.admin_list_admin_actions(integer) to authenticated;
grant execute on function public.admin_alerts() to authenticated;

-- Recharge du cache PostgREST.
notify pgrst, 'reload schema';