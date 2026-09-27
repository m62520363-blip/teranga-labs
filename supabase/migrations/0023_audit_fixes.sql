-- ============================================================
-- TERANGA LABS — Migration 0023 : correctifs d'audit
--
-- 1) requests.demo : les 6 briefs de démonstration du seed
--    (WhatsApp +2217710001xx) sont signalés « Exemple » et leur
--    déblocage devient GRATUIT (aucun Token débité).
-- 2) unlock_and_start_chat (réécrit) : ignore la charge en Tokens
--    lorsque le brief est un exemple de démonstration.
-- 3) contact_messages : formulaire de contact interactif.
--    Insertion publique, consultation/statut réservés à l'admin,
--    notification des administrateurs à la réception.
-- ============================================================

-- ------------------------------------------------------------
-- 1) requests.demo
-- ------------------------------------------------------------
alter table public.requests
  add column if not exists demo boolean not null default false;

-- Backfill : les briefs du seed de démonstration sont marqués.
update public.requests
   set demo = true
 where client_whatsapp like '+2217710001%';

-- La colonne demo devient lisible par PostgREST (grant par colonnes).
grant select (id, client_name, client_city, project_type, budget, description, status, hidden, created_at, budget_verified, max_unlocks, current_unlocks_count, features, deadline, demo)
  on public.requests to anon, authenticated;

-- ------------------------------------------------------------
-- 2) unlock_and_start_chat : déblocage gratuit des briefs de
--    démonstration (aucune balance requise, aucun débit).
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
      -- Déblocage antérieur (API legacy) sans conversation : on ouvre le
      -- chat sans redébiter.
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
-- 3) contact_messages : demande de contact du formulaire public.
-- ------------------------------------------------------------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'answered')),
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_status_idx on public.contact_messages (status);

alter table public.contact_messages enable row level security;

drop policy if exists contact_messages_insert_public on public.contact_messages;
create policy contact_messages_insert_public
  on public.contact_messages for insert
  to anon, authenticated
  with check (true);

drop policy if exists contact_messages_select_admin on public.contact_messages;
create policy contact_messages_select_admin
  on public.contact_messages for select
  to authenticated
  using (public.is_admin());

drop policy if exists contact_messages_update_admin on public.contact_messages;
create policy contact_messages_update_admin
  on public.contact_messages for update
  to authenticated
  using (public.is_admin());

grant insert on public.contact_messages to anon, authenticated;
grant select, update on public.contact_messages to authenticated;

-- ------------------------------------------------------------
-- RPC : submit_contact_message — enregistre la demande et
-- notifie les administrateurs.
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
  if length(p_message) > 5000 then
    raise exception 'Message trop long (5 000 caractères maximum).' using errcode = 'TLBAD';
  end if;
  if v_subject is not null and length(v_subject) > 200 then
    raise exception 'Objet trop long (200 caractères maximum).' using errcode = 'TLBAD';
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

-- ------------------------------------------------------------
-- RPC : admin_list_contact_messages / admin_update_contact_message
-- ------------------------------------------------------------
create or replace function public.admin_list_contact_messages(p_status text default 'new')
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
  if p_status not in ('new', 'read', 'answered') then
    raise exception 'Statut invalide.' using errcode = 'TLBAD';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'email', c.email,
          'subject', c.subject,
          'message', c.message,
          'status', c.status,
          'created_at', c.created_at
        )
        order by c.created_at desc
      ),
      '[]'::jsonb
    )
    from public.contact_messages c
    where c.status = p_status
  );
end;
$$;

create or replace function public.admin_update_contact_message(p_message_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;
  if p_status not in ('new', 'read', 'answered') then
    raise exception 'Statut invalide.' using errcode = 'TLBAD';
  end if;

  update public.contact_messages
     set status = p_status
   where id = p_message_id;

  if not found then
    raise exception 'Message introuvable.' using errcode = 'TLNOR';
  end if;

  return jsonb_build_object('message_id', p_message_id, 'status', p_status);
end;
$$;

-- ------------------------------------------------------------
-- Privilèges
-- ------------------------------------------------------------
grant execute on function public.submit_contact_message(text, text, text, text) to anon, authenticated;
grant execute on function public.admin_list_contact_messages(text) to authenticated;
grant execute on function public.admin_update_contact_message(uuid, text) to authenticated;