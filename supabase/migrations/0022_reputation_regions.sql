-- ============================================================
-- TERANGA LABS — Migration 0022 : réputation des développeurs
-- + modération complète (note, pénalité, notification, anti-spam)
-- + support des 14 régions du Sénégal.
--
-- 1) Colonnes réputation sur developers (gérées en base via
--    refresh_developer_reputation, jamais par l'utilisateur).
-- 2) Colonnes de modération sur reports (note, penalty, resolver).
-- 3) refresh_developer_reputation + triggers (reviews, unlocks).
-- 4) submit_report : anti-spam (1 signalement ouvert par cible/émetteur)
--    + interdiction d'auto-signalement.
-- 5) admin_resolve_report : résoudre/rejeter + note + pénalité
--    + notification à la cible.
-- 6) admin_list_reports / admin_list_developers / get_public_developer_profile :
--    exposent les nouvelles données.
-- ============================================================

-- ------------------------------------------------------------
-- 1) developers : colonnes de réputation
-- ------------------------------------------------------------
alter table public.developers
  add column if not exists reviews_count integer not null default 0,
  add column if not exists reputation_score integer not null default 0,
  add column if not exists reputation_level text not null default 'Nouveau',
  add column if not exists penalty integer not null default 0;

alter table public.developers
  drop constraint if exists developers_reputation_score_range;
alter table public.developers
  add constraint developers_reputation_score_range
    check (reputation_score between 0 and 100);

alter table public.developers
  drop constraint if exists developers_penalty_nonneg;
alter table public.developers
  add constraint developers_penalty_nonneg
    check (penalty >= 0);

-- ------------------------------------------------------------
-- 2) reports : colonnes de modération
-- ------------------------------------------------------------
alter table public.reports
  add column if not exists note text,
  add column if not exists penalty integer not null default 0,
  add column if not exists resolver_id uuid;

alter table public.reports
  drop constraint if exists reports_penalty_nonneg;
alter table public.reports
  add constraint reports_penalty_nonneg check (penalty >= 0);

-- ------------------------------------------------------------
-- 3) refresh_developer_reputation : score 0-100 pondéré, puis niveau.
--    Score = moyenne des notes (×60 %) + projets terminés (×20 %)
--            + nombre d'avis (×20 %), moins les pénalités de modération.
--    Projets terminés = déblocages marqués 'gagne' dans le CRM.
-- ------------------------------------------------------------
create or replace function public.refresh_developer_reputation(p_developer uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric;
  v_reviews integer;
  v_completed integer;
  v_penalty integer;
  v_score integer;
begin
  if p_developer is null then
    return;
  end if;

  select round(coalesce(avg(r.rating), 0), 2) into v_avg
    from public.reviews r
   where r.developer_id = p_developer;

  select count(*) into v_reviews
    from public.reviews r
   where r.developer_id = p_developer;

  select count(*) into v_completed
    from public.unlocks u
   where u.developer_id = p_developer
     and u.crm_status = 'gagne';

  select coalesce(penalty, 0) into v_penalty
    from public.developers
   where id = p_developer;

  v_score := round(
    least(v_avg / 5, 1) * 60
    + least(v_completed / 5, 1) * 20
    + least(v_reviews / 10, 1) * 20
  )::integer;
  v_score := v_score - v_penalty;
  v_score := greatest(0, least(100, v_score));

  update public.developers
     set rating_avg = v_avg,
         reviews_count = v_reviews,
         completed_projects_count = v_completed,
         reputation_score = v_score,
         reputation_level = case
           when v_score >= 85 then 'Expert'
           when v_score >= 70 then 'Confirmé'
           when v_score >= 40 then 'Actif'
           else 'Nouveau'
         end
   where id = p_developer;
end;
$$;

-- ------------------------------------------------------------
-- Triggers de recalcul automatique
-- ------------------------------------------------------------
create or replace function public.tgf_reputation_on_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_developer_reputation(coalesce(new.developer_id, old.developer_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reputation_on_reviews on public.reviews;
create trigger trg_reputation_on_reviews
  after insert or update or delete on public.reviews
  for each row
  execute function public.tgf_reputation_on_reviews();

create or replace function public.tgf_reputation_on_unlocks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_developer_reputation(coalesce(new.developer_id, old.developer_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reputation_on_unlocks on public.unlocks;
create trigger trg_reputation_on_unlocks
  after insert or update or delete on public.unlocks
  for each row
  execute function public.tgf_reputation_on_unlocks();

-- Les colonnes de réputation sont gérées par la modération : un
-- développeur ne peut jamais s'octroyer une réputation ou retirer sa
-- pénalité lui-même.
create or replace function public.developers_protect_managed_cols()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
begin
  -- Seul l'utilisateur directement connecté (REST, current_user =
  -- 'authenticated') est bloqué. Les fonctions SECURITY DEFINER
  -- (exécutées sous le rôle propriétaire) et le service_role peuvent
  -- maintenir ces colonnes : réputation, pénalités, validation.
  if current_user = 'authenticated' and v_role <> 'service_role' and not public.is_admin() then
    new.status := old.status;
    new.is_verified := old.is_verified;
    new.penalty := old.penalty;
    new.rating_avg := old.rating_avg;
    new.reviews_count := old.reviews_count;
    new.completed_projects_count := old.completed_projects_count;
    new.reputation_score := old.reputation_score;
    new.reputation_level := old.reputation_level;
  end if;
  return new;
end;
$$;

drop trigger if exists developers_protect_managed_cols_trigger on public.developers;
create trigger developers_protect_managed_cols_trigger
  before update on public.developers
  for each row
  execute function public.developers_protect_managed_cols();

-- ------------------------------------------------------------
-- 4) submit_report : anti-spam + pas d'auto-signalement
-- ------------------------------------------------------------
create or replace function public.submit_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter uuid := auth.uid();
begin
  if v_reporter is null then
    raise exception 'Connectez-vous pour signaler.' using errcode = 'TLNAU';
  end if;

  if p_target_type not in ('brief', 'developer') then
    raise exception 'Cible invalide.' using errcode = 'TLBAD';
  end if;

  if p_target_type = 'developer' and v_reporter = p_target_id then
    raise exception 'Vous ne pouvez pas signaler votre propre profil.' using errcode = 'TLBAD';
  end if;

  if p_reason is null or p_reason = '' then
    raise exception 'Précisez le motif du signalement.' using errcode = 'TLBAD';
  end if;

  if exists (
    select 1 from public.reports r
     where r.target_type = p_target_type
       and r.target_id = p_target_id
       and r.reporter_id = v_reporter
       and r.status = 'open'
  ) then
    raise exception 'Un signalement est déjà en cours pour ce contenu.' using errcode = 'TLSPM';
  end if;

  insert into public.reports (target_type, target_id, reporter_id, reason, description)
  values (p_target_type, p_target_id, v_reporter, p_reason, p_description);

  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------
-- 5) admin_resolve_report : remplace admin_update_report.
--    Note de modération + pénalité de réputation (au plus 50 pts)
--    + notification à la cible. La pénalité n'est applicable que
--    lorsqu'un signalement est confirmé (resolved).
-- ------------------------------------------------------------
create or replace function public.admin_resolve_report(
  p_report_id uuid,
  p_status text,
  p_note text default null,
  p_penalty integer default 0,
  p_notify_target boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports%rowtype;
  v_penalty integer := greatest(0, coalesce(p_penalty, 0));
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  if p_status not in ('resolved', 'dismissed') then
    raise exception 'Statut invalide.' using errcode = 'TLBAD';
  end if;

  if p_status = 'dismissed' and v_penalty > 0 then
    raise exception 'La pénalité n''est applicable que pour un signalement confirmé.' using errcode = 'TLBAD';
  end if;

  if v_penalty > 50 then
    raise exception 'Pénalité maximale : 50 points.' using errcode = 'TLBAD';
  end if;

  select * into v_report from public.reports where id = p_report_id;
  if v_report.id is null then
    raise exception 'Signalement introuvable.' using errcode = 'TLNOR';
  end if;

  update public.reports
     set status = p_status,
         resolved_at = now(),
         note = nullif(p_note, ''),
         penalty = v_penalty,
         resolver_id = auth.uid()
   where id = p_report_id;

  if p_status = 'resolved' and v_report.target_type = 'developer' then
    update public.developers
       set penalty = coalesce(penalty, 0) + v_penalty
     where id = v_report.target_id;

    perform public.refresh_developer_reputation(v_report.target_id);

    if p_notify_target then
      if v_penalty > 0 then
        perform public.notify_user(
          v_report.target_id,
          'moderation',
          'Avis de modération',
          format(
            'Notre équipe a confirmé un signalement concernant votre profil.%s Pénalité de réputation : %s points.',
            case when nullif(p_note, '') is not null then ' Motif : ' || nullif(p_note, '') || '.' else '' end,
            v_penalty
          ),
          '/dashboard',
          'developer',
          v_report.target_id
        );
      else
        perform public.notify_user(
          v_report.target_id,
          'moderation',
          'Signalement traité',
          'Notre équipe a examiné le signalement concernant votre profil. Aucune pénalité n''a été appliquée.',
          '/dashboard',
          'developer',
          v_report.target_id
        );
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'report_id', p_report_id,
    'status', p_status,
    'penalty', v_penalty,
    'target_type', v_report.target_type,
    'target_id', v_report.target_id
  );
end;
$$;

-- ------------------------------------------------------------
-- 6a) admin_list_reports : note, pénalité, cible nommée
-- ------------------------------------------------------------
create or replace function public.admin_list_reports(p_status text default 'open')
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

  if p_status not in ('open', 'resolved', 'dismissed') then
    raise exception 'Statut invalide.' using errcode = 'TLBAD';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'target_type', r.target_type,
          'target_id', r.target_id,
          'target_name', case
            when r.target_type = 'developer' then d.full_name
            else req.client_name
          end,
          'reporter_email', u.email,
          'reason', r.reason,
          'description', r.description,
          'note', r.note,
          'penalty', r.penalty,
          'status', r.status,
          'created_at', r.created_at,
          'resolved_at', r.resolved_at
        )
        order by r.created_at desc
      ),
      '[]'::jsonb
    )
    from public.reports r
    left join auth.users u on u.id = r.reporter_id
    left join public.developers d on d.id = r.target_id and r.target_type = 'developer'
    left join public.requests req on req.id = r.target_id and r.target_type = 'brief'
    where r.status = p_status
  );
end;
$$;

-- ------------------------------------------------------------
-- 6b) admin_list_developers : réputation + validation
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
          'is_verified', d.is_verified,
          'rating_avg', d.rating_avg,
          'reviews_count', d.reviews_count,
          'completed_projects_count', d.completed_projects_count,
          'reputation_score', d.reputation_score,
          'reputation_level', d.reputation_level,
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
-- 6c) get_public_developer_profile : réputation + avis complets
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
       and status = 'active';
  else
    select * into v_dev
      from public.developers
     where username = lower(v_identifier)
       and status = 'active';
  end if;

  if v_dev.id is null then
    raise exception 'Profil introuvable.' using errcode = 'TLNOK';
  end if;

  -- Temps de réponse moyen (en minutes) : pour chaque message envoyé par le
  -- client dans une discussion, écart avec la première réponse du développeur.
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

  -- Taux de réponse : discussions où le développeur a répondu au moins une
  -- fois, parmi les discussions où le client a écrit.
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
    'full_name', v_dev.full_name,
    'bio', v_dev.bio,
    'avatar_url', v_dev.avatar_url,
    'city', v_dev.city,
    'whatsapp', v_dev.whatsapp,
    'skills', coalesce(to_jsonb(v_dev.skills), '[]'::jsonb),
    'experience_years', v_dev.experience_years,
    'is_verified', v_dev.is_verified,
    'created_at', v_dev.created_at,
    'avg_response_minutes', v_response_minutes,
    'response_rate', v_response_rate,
    'portfolio_links', coalesce(v_dev.portfolio_links, '[]'::jsonb),
    'projects_count', (
      select count(*)::integer from public.unlocks u
       where u.developer_id = v_dev.id
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

-- ------------------------------------------------------------
-- 7) Fix notify_inapp_event : ne jamais lire new.sender_id tant que
--    tg_table_name n'est pas 'messages' (PL/pgSQL n'écourte pas les
--    booleens avant evaluation des champs record -> déclencheur IEEE
--    sur 'reviews' échouait). Conditions imbriquées.
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
        'account_certified',
        'Votre compte developpeur est valide',
        'Vous pouvez debloquer des briefs et envoyer des devis.',
        '/dashboard'
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- Privilèges
-- ------------------------------------------------------------
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text, text, integer, boolean) to authenticated;
grant execute on function public.admin_list_reports(text) to authenticated;
grant execute on function public.admin_list_developers() to authenticated;
grant execute on function public.refresh_developer_reputation(uuid) to service_role;

-- ------------------------------------------------------------
-- Backfill : recalcule la réputation de tous les développeurs.
-- ------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select id from public.developers
  loop
    perform public.refresh_developer_reputation(r.id);
  end loop;
end;
$$;