-- 0081_push_subscriptions.sql
-- Table pour stocker les abonnements push (Web Push API).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select_own
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

create policy push_subscriptions_insert_own
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy push_subscriptions_delete_own
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

-- RPC pour enregistrer un abonnement push.
create or replace function public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentification requise.' using errcode = 'TLAUT';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_uid, p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (user_id, endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.upsert_push_subscription(text, text, text, text) to authenticated;

-- RPC pour supprimer un abonnement push.
create or replace function public.delete_push_subscription(p_endpoint text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentification requise.' using errcode = 'TLAUT';
  end if;

  delete from public.push_subscriptions
  where user_id = v_uid and endpoint = p_endpoint;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.delete_push_subscription(text) to authenticated;
