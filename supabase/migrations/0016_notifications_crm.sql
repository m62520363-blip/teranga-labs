-- 0016_notifications_crm.sql
-- Notifications in-app (realtime) + rappels CRM + objectif mensuel.

-- ---------------------------------------------------------------------------
-- 1. Table notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  entity_type text,
  entity_id uuid,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read) where read = false;
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- L'insertion ne se fait que via les RPC/triggers SECURITY DEFINER ci-dessous.

-- ---------------------------------------------------------------------------
-- 2. RPC notifications
-- ---------------------------------------------------------------------------
create or replace function public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_entity_type text default null,
  p_entity_id uuid default null
) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id)
  values (p_user_id, p_type, p_title, p_body, p_link, p_entity_type, p_entity_id);
exception when others then
  null;
end;
$$;

create or replace function public.my_notifications(p_limit integer default 50)
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', n.id,
      'type', n.type,
      'title', n.title,
      'body', n.body,
      'link', n.link,
      'entity_type', n.entity_type,
      'entity_id', n.entity_id,
      'read', n.read,
      'created_at', n.created_at
    ) order by n.created_at desc
  ), '[]'::jsonb)
  from (
    select n.* from public.notifications n
    where n.user_id = auth.uid()
    order by n.created_at desc
    limit greatest(0, least(p_limit, 200))
  ) n;
$$;

create or replace function public.notifications_unread_count()
returns integer
language sql stable security definer set search_path to 'public'
as $$
  select count(*)::integer
  from public.notifications
  where user_id = auth.uid() and not read;
$$;

create or replace function public.mark_notifications_read(p_ids jsonb)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  update public.notifications
     set read = true
   where user_id = auth.uid()
     and id in (select (t.value)::uuid from jsonb_array_elements_text(p_ids) t);
end;
$$;

create or replace function public.mark_entity_notifications_read(p_entity_type text, p_entity_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  update public.notifications
     set read = true
   where user_id = auth.uid()
     and entity_type = p_entity_type
     and entity_id = p_entity_id
     and not read;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  update public.notifications
     set read = true
   where user_id = auth.uid() and not read;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Emetteur de notifications (triggers)
-- ---------------------------------------------------------------------------
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

  if tg_table_name = 'messages' and tg_op = 'INSERT' and new.sender_id is not null then
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
    return new;
  end if;

  if tg_table_name = 'formal_offers' and tg_op = 'UPDATE' and new.status = 'accepted' then
    perform public.notify_user(
      new.developer_id,
      'offer_accepted',
      'Votre devis a ete accepte',
      'Le client a accepte votre devis, une mission demarre.',
      '/conversations'
    );
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

  if tg_table_name = 'developers' and tg_op = 'UPDATE'
     and old.status = 'pending' and new.status = 'active' then
    perform public.notify_user(
      new.id,
      'account_certified',
      'Votre compte developpeur est valide',
      'Vous pouvez debloquer des briefs et envoyer des devis.',
      '/dashboard'
    );
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_inapp_on_unlocks on public.unlocks;
create trigger notify_inapp_on_unlocks
  after insert on public.unlocks
  for each row execute function public.notify_inapp_event();

drop trigger if exists notify_inapp_on_messages on public.messages;
create trigger notify_inapp_on_messages
  after insert on public.messages
  for each row execute function public.notify_inapp_event();

drop trigger if exists notify_inapp_on_offers on public.formal_offers;
create trigger notify_inapp_on_offers
  after update of status on public.formal_offers
  for each row execute function public.notify_inapp_event();

drop trigger if exists notify_inapp_on_reviews on public.reviews;
create trigger notify_inapp_on_reviews
  after insert on public.reviews
  for each row execute function public.notify_inapp_event();

drop trigger if exists notify_inapp_on_developers on public.developers;
create trigger notify_inapp_on_developers
  after update of status on public.developers
  for each row execute function public.notify_inapp_event();

-- ---------------------------------------------------------------------------
-- 4. Temps reel
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.notifications;
alter table public.notifications replica identity full;

-- ---------------------------------------------------------------------------
-- 5. CRM : rappels + objectif mensuel
-- ---------------------------------------------------------------------------
alter table public.unlocks add column if not exists reminder_at timestamptz;
alter table public.developers add column if not exists monthly_goal integer not null default 0;

create or replace function public.update_unlock_crm(
  p_unlock_id uuid,
  p_status text,
  p_notes text default null,
  p_reminder_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_unlock public.unlocks%rowtype;
  v_notes text;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour modifier vos contacts.' using errcode = 'TLNAU';
  end if;
  if p_status is null or p_status not in ('a_contacter', 'en_discussion', 'gagne', 'perdu') then
    raise exception 'Statut CRM invalide.' using errcode = 'TLBAD';
  end if;
  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  select * into v_unlock from public.unlocks where id = p_unlock_id;
  if v_unlock.id is null or v_unlock.developer_id <> v_user_id then
    raise exception 'Deblocage introuvable.' using errcode = 'TLNOU';
  end if;
  update public.unlocks
     set crm_status = p_status,
         notes = v_notes,
         reminder_at = p_reminder_at
   where id = p_unlock_id;
  return jsonb_build_object(
    'unlock_id', p_unlock_id,
    'crm_status', p_status,
    'notes', v_notes,
    'reminder_at', p_reminder_at
  );
end;
$$;

create or replace function public.set_monthly_goal(p_goal integer)
returns jsonb
language sql security definer set search_path to 'public'
as $$
  update public.developers
     set monthly_goal = greatest(0, least(coalesce(p_goal, 0), 1000))
   where id = auth.uid()
  returning jsonb_build_object('monthly_goal', monthly_goal);
$$;

-- Enrichit le detail des deblocages (rappels inclus).
create or replace function public.get_my_unlocks()
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'unlock_id', u.id,
        'request_id', r.id,
        'client_name', r.client_name,
        'client_city', r.client_city,
        'project_type', r.project_type,
        'budget', r.budget,
        'client_whatsapp', r.client_whatsapp,
        'unlocked_at', u.created_at,
        'crm_status', u.crm_status,
        'notes', u.notes,
        'reminder_at', u.reminder_at,
        'refund_status', tr.status
      )
      order by u.created_at desc
    ),
    '[]'::jsonb
  )
  from public.unlocks u
  join public.requests r on r.id = u.request_id
  left join public.token_refund_requests tr
    on tr.unlock_id = u.id
   and tr.status = 'pending'
  where u.developer_id = auth.uid();
$$;