-- ============================================================
-- TERANGA LABS — Migration 0013 : Architecture Master 3 univers
-- (Messagerie interne temps réel, flux Client, devis formels).
-- NB : la numérotation 0005 était déjà utilisée ; on est en fin de
-- chaîne (0001 → 0012 déjà poussés).
-- ============================================================

-- ------------------------------------------------------------
-- A.1 — user_roles : rôle 'client' ajouté au CHECK (pas un enum).
-- ------------------------------------------------------------
alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('client', 'developer', 'moderator', 'admin'));

-- ------------------------------------------------------------
-- A.2 — client_profiles : fiche privée du client (téléphone jamais
-- exposé). La ligne developers reste créée pour le compteur de
-- tokens (publier = 1 Token) mais reste invisible (status 'suspended').
-- ------------------------------------------------------------
create table public.client_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_name text,
  contact_name text,
  phone text,
  city text,
  created_at timestamptz not null default now()
);

alter table public.client_profiles enable row level security;

create policy "client_profiles_select_own"
  on public.client_profiles for select
  to authenticated
  using (id = auth.uid());

create policy "client_profiles_update_own"
  on public.client_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant select, update on public.client_profiles to authenticated;

-- ------------------------------------------------------------
-- A.3 — developers : indicateurs de la vitrine publique.
-- ------------------------------------------------------------
alter table public.developers
  add column if not exists rating_avg numeric(3, 2) not null default 5.0,
  add column if not exists completed_projects_count integer not null default 0;

-- ------------------------------------------------------------
-- A.4 — handle_new_user v3 : branchement sur le rôle choisi au
-- signup (metadata 'role' ; défaut 'developer' pour rétrocompat).
--   - developer : ligne developers 'pending' + user_roles 'developer'
--   - client    : ligne developers 'suspended' (invisible, compteur
--                 de tokens pour payer la publication) + client_profiles
--                 + user_roles 'client'
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'developer');
begin
  if v_role = 'client' then
    insert into public.developers (id, full_name, whatsapp, status)
    values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'whatsapp', ''), 'suspended');

    insert into public.client_profiles (id, company_name, contact_name, phone, city)
    values (
      new.id,
      nullif(new.raw_user_meta_data ->> 'company_name', ''),
      coalesce(
        nullif(new.raw_user_meta_data ->> 'contact_name', ''),
        nullif(new.raw_user_meta_data ->> 'full_name', '')
      ),
      nullif(new.raw_user_meta_data ->> 'whatsapp', ''),
      nullif(new.raw_user_meta_data ->> 'city', '')
    );

    insert into public.user_roles (user_id, role)
    values (new.id, 'client');
  else
    insert into public.developers (id, full_name, whatsapp, skills)
    values (
      new.id,
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'whatsapp', ''),
      case
        when jsonb_typeof(new.raw_user_meta_data -> 'skills') = 'array'
          then (
            select coalesce(array_agg(v), '{}'::text[])
            from jsonb_array_elements_text(new.raw_user_meta_data -> 'skills') as v
          )
        when new.raw_user_meta_data ? 'skills'
          then array[nullif(new.raw_user_meta_data ->> 'skills', '')]
        else null
      end
    );

    insert into public.user_roles (user_id, role)
    values (new.id, 'developer');
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- B — requests : colonnes du flux Client + concurrence.
-- ------------------------------------------------------------
alter table public.requests
  add column if not exists client_id uuid references auth.users(id) on delete set null,
  add column if not exists max_unlocks integer not null default 4,
  add column if not exists current_unlocks_count integer not null default 0,
  add column if not exists selected_developer_id uuid references auth.users(id) on delete set null,
  add column if not exists features jsonb not null default '[]'::jsonb,
  add column if not exists deadline text;

alter table public.requests
  drop constraint if exists requests_max_unlocks_check;

alter table public.requests
  add constraint requests_max_unlocks_check check (max_unlocks >= 1);

-- Nouveau type « refonte » pour l'assistant client.
alter table public.requests
  drop constraint if exists requests_project_type_check;

alter table public.requests
  add constraint requests_project_type_check
  check (project_type in ('vitrine', 'e-commerce', 'landing page', 'app web', 'refonte'));

create index if not exists requests_client_idx on public.requests (client_id);

-- Colonnes publiques (la jauge de concurrence est publique).
grant select (id, client_name, client_city, project_type, budget, description, status, hidden, created_at, max_unlocks, current_unlocks_count, features, deadline)
  on public.requests to anon, authenticated;

-- ------------------------------------------------------------
-- C — Messagerie interne temps réel.
-- ------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete cascade not null,
  developer_id uuid references auth.users(id) on delete cascade,
  client_id uuid references auth.users(id) on delete cascade,
  status text not null default 'active' check (
    status in ('active', 'awarded', 'archived')
  ),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (request_id, developer_id)
);

create index conversations_developer_idx on public.conversations (developer_id);
create index conversations_client_idx on public.conversations (client_id);
create index conversations_request_idx on public.conversations (request_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references auth.users(id) on delete cascade,
  content text not null,
  message_type text not null default 'text' check (
    message_type in ('text', 'offer', 'system')
  ),
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- Réplication complète + Realtime pour le chat en direct.
alter table public.conversations replica identity full;
alter table public.messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- RLS : seuls les participants d'une conversation y ont accès.
alter table public.conversations enable row level security;

create policy "conversations_select_participant"
  on public.conversations for select
  to authenticated
  using (developer_id = auth.uid() or client_id = auth.uid());

create policy "conversations_update_participant"
  on public.conversations for update
  to authenticated
  using (developer_id = auth.uid() or client_id = auth.uid())
  with check (developer_id = auth.uid() or client_id = auth.uid());

alter table public.messages enable row level security;

create policy "messages_select_participant"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.developer_id = auth.uid() or c.client_id = auth.uid())
    )
  );

create policy "messages_insert_sender_participant"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.developer_id = auth.uid() or c.client_id = auth.uid())
        and c.status = 'active'
    )
  );

create policy "messages_update_read_participant"
  on public.messages for update
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.developer_id = auth.uid() or c.client_id = auth.uid())
    )
  );

grant select, insert, update on public.messages to authenticated;
grant select, update on public.conversations to authenticated;

-- ------------------------------------------------------------
-- D — Devis formels + évaluations (reviews étendues).
-- ------------------------------------------------------------
create table public.formal_offers (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  developer_id uuid references auth.users(id) on delete cascade,
  total_price_fcfa integer not null check (total_price_fcfa >= 1),
  deposit_fcfa integer check (deposit_fcfa >= 0),
  delivery_days integer not null check (delivery_days >= 1),
  description text,
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'rejected')
  ),
  created_at timestamptz not null default now()
);

create index formal_offers_conversation_idx on public.formal_offers (conversation_id);

alter table public.formal_offers enable row level security;

create policy "formal_offers_select_participant"
  on public.formal_offers for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = formal_offers.conversation_id
        and (c.developer_id = auth.uid() or c.client_id = auth.uid())
    )
  );

create policy "formal_offers_insert_developer"
  on public.formal_offers for insert
  to authenticated
  with check (
    developer_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = formal_offers.conversation_id
        and c.developer_id = auth.uid()
        and c.status <> 'awarded'
    )
  );

create policy "formal_offers_update_client"
  on public.formal_offers for update
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = formal_offers.conversation_id
        and c.client_id = auth.uid()
    )
  );

grant select, insert, update on public.formal_offers to authenticated;

-- reviews : client_id + notation 3 critères (extension, pas remplacement).
alter table public.reviews
  add column if not exists client_id uuid references auth.users(id) on delete set null,
  add column if not exists rating_quality integer check (rating_quality between 1 and 5),
  add column if not exists rating_deadline integer check (rating_deadline between 1 and 5),
  add column if not exists rating_communication integer check (rating_communication between 1 and 5);

-- ------------------------------------------------------------
-- E — RPC : publish_brief enrichi (client_id + features + deadline)
-- ------------------------------------------------------------
drop function if exists public.publish_brief(text, text, text, text, integer, text);

create or replace function public.publish_brief(
  p_client_name text,
  p_client_whatsapp text,
  p_client_city text,
  p_project_type text,
  p_budget integer,
  p_description text,
  p_features jsonb default '[]'::jsonb,
  p_deadline text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_req public.requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour publier un brief.' using errcode = 'TLAUTH';
  end if;

  if p_client_name is null or length(btrim(p_client_name)) < 2 then
    raise exception 'Nom du client manquant.' using errcode = 'TLBAD';
  end if;
  if p_client_whatsapp is null or p_client_whatsapp = '' then
    raise exception 'Numéro WhatsApp manquant.' using errcode = 'TLBAD';
  end if;
  if p_budget is null or p_budget < 10000 then
    raise exception 'Budget invalide (minimum 10000 F).' using errcode = 'TLBAD';
  end if;
  if p_project_type not in ('vitrine', 'e-commerce', 'landing page', 'app web', 'refonte') then
    raise exception 'Type de projet invalide.' using errcode = 'TLBAD';
  end if;

  select coalesce(sum(t.amount), 0)::integer into v_balance
    from public.token_transactions t
    where t.developer_id = v_user_id;

  if v_balance < 1 then
    raise exception 'Tokens insuffisants. Rechargez vos Tokens pour publier un brief (1 Token).' using errcode = 'TLLOW';
  end if;

  perform 1 from public.developers where id = v_user_id for update;

  insert into public.requests (
    client_name, client_whatsapp, client_city, project_type, budget, description,
    client_id, features, deadline
  ) values (
    p_client_name,
    p_client_whatsapp,
    p_client_city,
    p_project_type,
    p_budget,
    p_description,
    v_user_id,
    coalesce(p_features, '[]'::jsonb),
    p_deadline
  )
  returning * into v_req;

  insert into public.token_transactions (developer_id, amount, type, request_id)
  values (v_user_id, -1, 'publish', v_req.id);

  return jsonb_build_object(
    'id', v_req.id,
    'management_key', v_req.management_key
  );
end;
$$;

grant execute on function public.publish_brief(text, text, text, text, integer, text, jsonb, text) to authenticated;

-- ------------------------------------------------------------
-- E — RPC : unlock_and_start_chat (débloque + ouvre le chat).
-- Idempotent : re-appel sans second débit, conversation partagée.
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
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour débloquer un contact.' using errcode = 'TLNAU';
  end if;

  select * into v_dev from public.developers where id = v_user_id;
  if v_dev.id is null then
    raise exception 'Profil développeur requis.' using errcode = 'TLNOD';
  end if;
  if v_dev.status <> 'active' then
    if v_dev.status = 'pending' then
      raise exception 'Votre compte développeur est en attente de validation.' using errcode = 'TLPEN';
    end if;
    raise exception 'Votre compte développeur ne permet pas de débloquer des contacts.' using errcode = 'TLRJC';
  end if;

  -- Sérialise les déblocages/ouvertures concurrents pour cette annonce.
  select * into v_req from public.requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'Ce brief n''existe pas.' using errcode = 'TLNOR';
  end if;
  if v_req.status <> 'ouvert' then
    raise exception 'Ce brief n''est plus disponible.' using errcode = 'TLCLO';
  end if;

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
      -- Déblocage antérieur (API legacy) sans conversation : on ouvre le
      -- chat sans redébiter.
      null;
    else
      select coalesce(sum(t.amount), 0)::integer into v_balance
        from public.token_transactions t
        where t.developer_id = v_user_id;

      if v_balance < 1 then
        raise exception 'Tokens insuffisants. Rechargez vos Tokens.' using errcode = 'TLLOW';
      end if;

      perform 1 from public.developers where id = v_user_id for update;

      insert into public.token_transactions (developer_id, amount, type, request_id)
      values (v_user_id, -1, 'unlock', p_request_id);

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
    'balance', (
      select coalesce(sum(t.amount), 0)::integer
      from public.token_transactions t
      where t.developer_id = v_user_id
    )
  );
end;
$$;

grant execute on function public.unlock_and_start_chat(uuid, text, integer, integer) to authenticated;

-- ------------------------------------------------------------
-- E — RPC : accept_formal_offer (sélection 1 clic).
-- ------------------------------------------------------------
create or replace function public.accept_formal_offer(p_offer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.formal_offers%rowtype;
  v_conv public.conversations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour sélectionner un développeur.' using errcode = 'TLNAU';
  end if;

  select * into v_offer from public.formal_offers where id = p_offer_id;
  if v_offer.id is null then
    raise exception 'Devis introuvable.' using errcode = 'TLNOF';
  end if;

  select * into v_conv from public.conversations where id = v_offer.conversation_id;
  if v_conv.id is null or v_conv.client_id <> v_user_id then
    raise exception 'Devis introuvable pour votre compte.' using errcode = 'TLNOF';
  end if;

  if v_offer.status <> 'pending' then
    raise exception 'Ce devis n''est plus en attente.' using errcode = 'TLOFR';
  end if;

  update public.formal_offers
     set status = 'accepted'
   where id = p_offer_id;

  update public.requests
     set selected_developer_id = v_conv.developer_id,
         status = 'attribué'
   where id = v_conv.request_id;

  update public.conversations
     set status = 'awarded',
         last_message_at = now()
   where id = v_conv.id;

  -- Clôture : les autres candidats sont archivés, leurs devis rejetés.
  update public.conversations
     set status = 'archived'
   where request_id = v_conv.request_id
     and id <> v_conv.id;

  update public.formal_offers
     set status = 'rejected'
   where conversation_id in (
     select id from public.conversations
     where request_id = v_conv.request_id and id <> v_conv.id
   )
   and status = 'pending';

  insert into public.messages (conversation_id, sender_id, content, message_type)
  values (v_conv.id, v_user_id, 'Devis accepté. Le projet démarre, bienvenue à bord !', 'system');

  return jsonb_build_object(
    'conversation_id', v_conv.id,
    'request_id', v_conv.request_id,
    'developer_id', v_conv.developer_id,
    'offer_id', p_offer_id
  );
end;
$$;

grant execute on function public.accept_formal_offer(uuid) to authenticated;

-- ------------------------------------------------------------
-- Privilèges : les fonctions de la messagerie sont réservées aux
-- sessions authentifiées (jamais public/anon).
-- ------------------------------------------------------------
revoke execute on function public.unlock_and_start_chat(uuid, text, integer, integer) from public;
revoke execute on function public.accept_formal_offer(uuid) from public;
revoke execute on function public.publish_brief(text, text, text, text, integer, text, jsonb, text) from public;