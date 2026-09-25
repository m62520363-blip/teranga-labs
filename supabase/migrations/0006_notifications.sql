-- ============================================================
-- TERANGA LABS — Migration 0006 : notifications & modération
-- 1) Ciblage développeurs selon la ville + compétences
--    (developers.city, developers.notifications_enabled)
-- 2) Badge « Budget vérifié » validé par l'admin
--    (requests.budget_verified)
-- 3) File de notifications en base (notification_jobs) :
--    un trigger enfile la confirmation client + le ciblage
--    développeurs à la publication d'un brief, puis un
--    dispatcher serveur les envoie en tâche de fond.
--
-- Principe d'honnêteté : l'envoi réel dépend des canaux
-- configurés (webhook Make/n8n, WhatsApp Green-API/Twilio, ou
-- email). Sans canal configuré, aucun message n'est simulé :
-- le job est marqué failed avec un message explicite.
-- ============================================================

-- ------------------------------------------------------------
-- 1) developers : ville + consentement aux notifications
-- ------------------------------------------------------------
alter table public.developers
  add column if not exists city text,
  add column if not exists notifications_enabled boolean not null default true;

-- ------------------------------------------------------------
-- 2) requests.budget_verified : badge affiché publiquement,
--    mis à true UNIQUEMENT par l'admin (jamais par le client).
-- ------------------------------------------------------------
alter table public.requests
  add column if not exists budget_verified boolean not null default false;

-- Le badge est lisible publiquement : on étend le grant SELECT.
grant select (id, client_name, client_city, project_type, budget, description, status, hidden, created_at, budget_verified)
  on public.requests to anon, authenticated;

-- ------------------------------------------------------------
-- 3) notification_jobs : file de messages à envoyer
--    En lecture/écriture UNIQUEMENT côté serveur (service_role) :
--    aucun droit accordé à anon/authenticated.
-- ------------------------------------------------------------
create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('client_confirmation', 'developer_matches')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists notification_jobs_status_idx on public.notification_jobs (status, created_at);

alter table public.notification_jobs enable row level security;
-- Aucune policy : la table reste inaccessible au public.
-- Seul le service_role (clé serveur) la lit/la met à jour.

-- ------------------------------------------------------------
-- Trigger : enfile les notifications à la création d'un brief
-- ouvert et visible. Jamais bloquant : en cas d'erreur, le
-- brief est publié quand même.
-- ------------------------------------------------------------
create or replace function public.enqueue_notification_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_payload jsonb;
  v_dev_payload jsonb;
begin
  if new.status = 'ouvert' and new.hidden = false then
    v_client_payload := jsonb_build_object(
      'request_id', new.id,
      'client_name', new.client_name,
      'client_whatsapp', new.client_whatsapp,
      'client_city', new.client_city,
      'project_type', new.project_type,
      'budget', new.budget,
      'management_key', new.management_key
    );
    v_dev_payload := jsonb_build_object(
      'request_id', new.id,
      'client_name', new.client_name,
      'client_city', new.client_city,
      'project_type', new.project_type,
      'budget', new.budget
    );
    begin
      insert into public.notification_jobs (type, payload) values
        ('client_confirmation', v_client_payload),
        ('developer_matches', v_dev_payload);
    exception when others then
      -- Ne jamais bloquer la publication du brief.
      null;
    end;
  end if;
  return new;
end;
$$;

create trigger requests_notify_trigger
  after insert on public.requests
  for each row execute function public.enqueue_notification_jobs();

-- ------------------------------------------------------------
-- RPC : liste des développeurs à notifier pour un brief.
-- Cible = comptes actifs ayant accepté les notifications et
-- un WhatsApp, dont la ville OU les compétences correspondent.
-- ------------------------------------------------------------
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
  where d.status = 'active'
    and d.notifications_enabled = true
    and d.whatsapp is not null
    and (
      (v_city is not null and d.city is not null and d.city = v_city)
      or (cardinality(v_keywords) > 0 and d.skills && v_keywords)
    );

  return v_rows;
end;
$$;

-- ------------------------------------------------------------
-- RPC admin : valider / dévalider le budget d'un brief.
-- ------------------------------------------------------------
create or replace function public.admin_set_budget_verified(
  p_request_id uuid,
  p_verified boolean
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

  if p_verified is null then
    raise exception 'Valeur invalide.' using errcode = 'TLBAD';
  end if;

  update public.requests set budget_verified = p_verified where id = p_request_id;

  if not found then
    raise exception 'Brief introuvable.' using errcode = 'TLNOR';
  end if;

  return jsonb_build_object('request_id', p_request_id, 'budget_verified', p_verified);
end;
$$;

-- ------------------------------------------------------------
-- admin_list_requests : expose budget_verified à l'admin.
-- ------------------------------------------------------------
create or replace function public.admin_list_requests()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'client_name', r.client_name,
          'client_whatsapp', r.client_whatsapp,
          'client_city', r.client_city,
          'project_type', r.project_type,
          'budget', r.budget,
          'budget_verified', r.budget_verified,
          'description', r.description,
          'status', r.status,
          'hidden', r.hidden,
          'created_at', r.created_at
        )
        order by r.created_at desc
      ),
      '[]'::jsonb
    )
    from public.requests r
  );
end;
$$;

-- ------------------------------------------------------------
-- admin_list_developers : expose ville + consentement.
-- ------------------------------------------------------------
create or replace function public.admin_list_developers()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'full_name', d.full_name,
          'email', du.email,
          'whatsapp', d.whatsapp,
          'skills', d.skills,
          'city', d.city,
          'notifications_enabled', d.notifications_enabled,
          'status', d.status,
          'balance', coalesce((
            select sum(t.amount)::integer
            from public.token_transactions t
            where t.developer_id = d.id
          ), 0),
          'created_at', d.created_at
        )
        order by d.created_at desc
      ),
      '[]'::jsonb
    )
    from public.developers d
    left join auth.users du on du.id = d.id
  );
end;
$$;

-- ------------------------------------------------------------
-- Privilèges
-- ------------------------------------------------------------
grant execute on function public.list_developers_for_brief(text, text[]) to service_role, authenticated;
grant execute on function public.admin_set_budget_verified(uuid, boolean) to authenticated;
grant execute on function public.admin_list_requests() to authenticated;
grant execute on function public.admin_list_developers() to authenticated;