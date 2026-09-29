-- 0030_reviews_system.sql
-- Système complet d'avis & notation après une mission terminée.
-- Le client (auth) évalue le développeur attribué à la mission.
-- Un seul avis par mission : unique(request_id, developer_id) déjà en place.

-- ---------------------------------------------------------------------------
-- 1. reviews : colonnes étendues (critères, questions, médias, réponse,
--    modération). developer_id = développeur noté, client_id = auteur.
-- ---------------------------------------------------------------------------
alter table public.reviews
  add column if not exists client_id uuid references auth.users(id) on delete set null,
  add column if not exists criteria jsonb not null default '{}'::jsonb,
  add column if not exists questions jsonb not null default '{}'::jsonb,
  add column if not exists assets text[] not null default '{}',
  add column if not exists response text,
  add column if not exists responded_at timestamptz,
  add column if not exists hidden boolean not null default false,
  add column if not exists admin_note text;

create index if not exists reviews_client_idx on public.reviews (client_id);
create index if not exists reviews_dev_visible_idx
  on public.reviews (developer_id, hidden, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. reports : la cible 'review' est désormais autorisée.
-- ---------------------------------------------------------------------------
alter table public.reports
  drop constraint if exists reports_target_type_check;

alter table public.reports
  add constraint reports_target_type_check
    check (target_type in ('brief', 'developer', 'review'));

-- ---------------------------------------------------------------------------
-- 3. refresh_developer_reputation : ne comptabiliser que les avis visibles.
--    Un avis masqué par la modération ne doit plus alimenter les stats.
-- ---------------------------------------------------------------------------
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
   where r.developer_id = p_developer
     and coalesce(r.hidden, false) = false;

  select count(*) into v_reviews
    from public.reviews r
   where r.developer_id = p_developer
     and coalesce(r.hidden, false) = false;

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

-- ---------------------------------------------------------------------------
-- 4. submit_review (réécrit) : le client connecté note le développeur de sa
--    mission. La mission doit être 'terminé'. Un seul avis par mission
--    (upsert). Critères (8 clés, notes 1-5), questions (4 clés,
--    oui/partiellement/non), médias (URLs, max 3).
-- ---------------------------------------------------------------------------
drop function if exists public.submit_review(uuid, uuid, integer, text);

create or replace function public.submit_review(
  p_request_id uuid,
  p_rating integer,
  p_comment text default null,
  p_criteria jsonb default null,
  p_questions jsonb default null,
  p_assets text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.requests%rowtype;
  v_developer uuid;
  v_review_id uuid;
  v_k text;
  v_v text;
  v_assets text[] := '{}'::text[];
  i integer;
begin
  if auth.uid() is null then
    raise exception 'Connectez-vous pour laisser un avis.' using errcode = 'TLNAU';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Note globale invalide (1 à 5).' using errcode = 'TLBAD';
  end if;

  if p_request_id is null then
    raise exception 'Mission introuvable.' using errcode = 'TLNOK';
  end if;

  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'Mission introuvable.' using errcode = 'TLNOK';
  end if;

  if v_req.client_id is null or v_req.client_id <> auth.uid() then
    raise exception 'Seul le client de la mission peut déposer cet avis.' using errcode = 'TLFOR';
  end if;

  if v_req.status <> 'terminé' then
    raise exception 'La mission doit être terminée pour être évaluée.' using errcode = 'TLTMP';
  end if;

  -- Développeur rattaché : développeur choisi, sinon conversation attribuée.
  select coalesce(
    v_req.selected_developer_id,
    (
      select c.developer_id from public.conversations c
       where c.request_id = v_req.id and c.status = 'awarded'
       order by c.created_at desc limit 1
    )
  ) into v_developer;

  if v_developer is null then
    raise exception 'Aucun développeur n''est rattaché à cette mission.' using errcode = 'TLNDV';
  end if;

  -- Critères
  if p_criteria is not null and p_criteria <> '{}'::jsonb then
    for v_k in select jsonb_object_keys(p_criteria) loop
      if v_k not in (
        'qualite', 'delais', 'communication', 'comprehension',
        'interface', 'fonctionnalites', 'qualite_prix', 'professionnalisme'
      ) then
        raise exception 'Critère invalide : %', v_k using errcode = 'TLBAD';
      end if;
      v_v := p_criteria ->> v_k;
      if v_v is null or v_v !~ '^[1-5]$' then
        raise exception 'Note de critère invalide (1 à 5).' using errcode = 'TLBAD';
      end if;
    end loop;
  end if;

  -- Questions
  if p_questions is not null and p_questions <> '{}'::jsonb then
    for v_k in select jsonb_object_keys(p_questions) loop
      if v_k not in ('conforme', 'reactivite', 'recommandation', 'retenir') then
        raise exception 'Question invalide : %', v_k using errcode = 'TLBAD';
      end if;
      v_v := p_questions ->> v_k;
      if v_v is null or v_v not in ('oui', 'partiellement', 'non') then
        raise exception 'Réponse invalide.' using errcode = 'TLBAD';
      end if;
    end loop;
  end if;

  -- Médias (URLs, max 3)
  if p_assets is not null then
    if coalesce(array_length(p_assets, 1), 0) > 3 then
      raise exception 'Maximum 3 captures autorisées.' using errcode = 'TLBAD';
    end if;
    for i in 1..coalesce(array_length(p_assets, 1), 0) loop
      v_v := nullif(btrim(coalesce(p_assets[i], '')), '');
      if v_v is not null then
        if char_length(v_v) > 1000 then
          raise exception 'Lien trop long.' using errcode = 'TLBAD';
        end if;
        if v_v !~ '^https?://' then
          raise exception 'Les captures doivent être des liens http(s).' using errcode = 'TLBAD';
        end if;
        v_assets := array_append(v_assets, v_v);
      end if;
    end loop;
  end if;

  insert into public.reviews (
    developer_id, request_id, client_id, rating, comment,
    criteria, questions, assets, updated_at
  )
  values (
    v_developer, v_req.id, auth.uid(), p_rating,
    nullif(btrim(coalesce(p_comment, '')), ''),
    coalesce(p_criteria, '{}'::jsonb),
    coalesce(p_questions, '{}'::jsonb),
    v_assets,
    now()
  )
  on conflict (request_id, developer_id)
  do update set
    client_id = excluded.client_id,
    rating = excluded.rating,
    comment = excluded.comment,
    criteria = excluded.criteria,
    questions = excluded.questions,
    assets = excluded.assets,
    updated_at = now()
  returning id into v_review_id;

  return jsonb_build_object(
    'review_id', v_review_id,
    'request_id', v_req.id,
    'developer_id', v_developer,
    'rating', p_rating
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. get_review_for_request : contexte complet pour la page d'évaluation.
--    Réservé au client propriétaire de la mission.
-- ---------------------------------------------------------------------------
create or replace function public.get_review_for_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_req public.requests%rowtype;
  v_developer uuid;
begin
  if auth.uid() is null then
    raise exception 'Connectez-vous.' using errcode = 'TLNAU';
  end if;

  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'Mission introuvable.' using errcode = 'TLNOK';
  end if;

  if v_req.client_id is null or v_req.client_id <> auth.uid() then
    raise exception 'Accès refusé.' using errcode = 'TLFOR';
  end if;

  select coalesce(
    v_req.selected_developer_id,
    (
      select c.developer_id from public.conversations c
       where c.request_id = v_req.id and c.status = 'awarded'
       order by c.created_at desc limit 1
    )
  ) into v_developer;

  return jsonb_build_object(
    'request', jsonb_build_object(
      'id', v_req.id,
      'client_name', v_req.client_name,
      'project_type', v_req.project_type,
      'budget', v_req.budget,
      'description', v_req.description,
      'status', v_req.status,
      'created_at', v_req.created_at
    ),
    'developer', (
      select jsonb_build_object(
        'id', d.id,
        'full_name', d.full_name,
        'username', d.username,
        'avatar_url', d.avatar_url
      )
      from public.developers d
      where d.id = v_developer
    ),
    'review', (
      select jsonb_build_object(
        'id', rv.id,
        'rating', rv.rating,
        'comment', rv.comment,
        'criteria', rv.criteria,
        'questions', rv.questions,
        'assets', to_jsonb(rv.assets),
        'created_at', rv.created_at,
        'updated_at', rv.updated_at,
        'hidden', rv.hidden
      )
      from public.reviews rv
      where rv.request_id = v_req.id and rv.developer_id = v_developer
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. get_my_request_reviews : carte {request_id, review_id} du client,
--    pour afficher « Évaluer » / « Avis déposé » sur l'espace client.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_request_reviews()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'request_id', rv.request_id,
      'review_id', rv.id,
      'rating', rv.rating,
      'created_at', rv.created_at
    )
  ), '[]'::jsonb)
  from public.reviews rv
  join public.requests req on req.id = rv.request_id
  where req.client_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 7. list_my_developer_reviews : « Mes avis » du développeur (il voit aussi
--    les avis masqués, avec le champ hidden, pour suivre la modération).
-- ---------------------------------------------------------------------------
create or replace function public.list_my_developer_reviews()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_dev uuid := auth.uid();
  v_result jsonb;
begin
  if v_dev is null then
    return null;
  end if;

  select jsonb_build_object(
    'total', count(*)::integer,
    'average', round(coalesce(avg(rv.rating), 0), 1)::numeric,
    'satisfaction', case
       when count(*) > 0
       then round(100.0 * count(*) filter (where rv.rating >= 4) / count(*))::integer
       else 0 end,
    'reviews', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', rv.id,
        'rating', rv.rating,
        'comment', rv.comment,
        'criteria', rv.criteria,
        'questions', rv.questions,
        'assets', to_jsonb(rv.assets),
        'response', rv.response,
        'responded_at', rv.responded_at,
        'hidden', rv.hidden,
        'admin_note', rv.admin_note,
        'client_name', coalesce(
          nullif(au.raw_user_meta_data->>'full_name', ''),
          au.raw_user_meta_data->>'company_name',
          req.client_name
        ),
        'request_type', req.project_type,
        'request_budget', req.budget,
        'created_at', rv.created_at
      ) order by rv.created_at desc
    ), '[]'::jsonb)
  ) into v_result
  from public.reviews rv
  left join public.requests req on req.id = rv.request_id
  left join auth.users au on au.id = rv.client_id
  where rv.developer_id = v_dev;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. respond_to_review : réponse publique du développeur. La réponse ne
--    modifie jamais la note, le commentaire ni les critères de l'avis.
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_review(
  p_review_id uuid,
  p_response text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response text := nullif(btrim(coalesce(p_response, '')), '');
  v_review public.reviews%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Connectez-vous.' using errcode = 'TLNAU';
  end if;

  if char_length(coalesce(v_response, '')) > 2000 then
    raise exception 'Réponse trop longue (2000 caractères max).' using errcode = 'TLBAD';
  end if;

  select * into v_review from public.reviews where id = p_review_id;
  if v_review.id is null then
    raise exception 'Avis introuvable.' using errcode = 'TLNOK';
  end if;

  if v_review.developer_id <> auth.uid() then
    raise exception 'Seul le développeur concerné peut répondre.' using errcode = 'TLFOR';
  end if;

  update public.reviews
     set response = v_response,
         responded_at = now()
   where id = v_review.id;

  if v_response is not null and v_review.client_id is not null then
    perform public.notify_user(
      v_review.client_id,
      'review_responded',
      'Le développeur a répondu à votre avis',
      'Consultez sa réponse publique sur la mission.',
      '/review/' || v_review.request_id::text,
      'review',
      v_review.id
    );
  end if;

  return jsonb_build_object('review_id', v_review.id, 'response', v_response);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. submit_review_report : signalement d'un avis (7 motifs gérés côté UI).
-- ---------------------------------------------------------------------------
create or replace function public.submit_review_report(
  p_review_id uuid,
  p_reason text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter uuid := auth.uid();
  v_review public.reviews%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reporter is null then
    raise exception 'Connectez-vous pour signaler.' using errcode = 'TLNAU';
  end if;

  if v_reason is null or v_reason = '' then
    raise exception 'Précisez le motif du signalement.' using errcode = 'TLBAD';
  end if;

  select * into v_review from public.reviews where id = p_review_id;
  if v_review.id is null then
    raise exception 'Avis introuvable.' using errcode = 'TLNOK';
  end if;

  -- Idempotent : un signalement ouvert existe déjà pour ce couple.
  if exists (
    select 1 from public.reports
     where target_type = 'review'
       and target_id = v_review.id
       and reporter_id = v_reporter
       and status = 'open'
  ) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  insert into public.reports (target_type, target_id, reporter_id, reason, description)
  values ('review', v_review.id, v_reporter, v_reason, nullif(btrim(coalesce(p_description, '')), ''));

  return jsonb_build_object('ok', true, 'already', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. get_developer_reviews (réécrit) : stats complètes + listes publiques,
--     uniquement les avis visibles.
-- ---------------------------------------------------------------------------
create or replace function public.get_developer_reviews(p_developer uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'total', count(*)::integer,
    'average', round(coalesce(avg(r.rating), 0), 1)::numeric,
    'satisfaction', case
       when count(*) > 0
       then round(100.0 * count(*) filter (where r.rating >= 4) / count(*))::integer
       else 0 end,
    'average_criteria', coalesce(
      (
        select jsonb_object_agg(x.key, x.avg)
          from (
            select me.key as key, round(avg((me.value)::numeric), 1) as avg
              from public.reviews r2
             cross join lateral jsonb_each_text(r2.criteria) me
             where r2.developer_id = p_developer
               and coalesce(r2.hidden, false) = false
               and me.value ~ '^[0-9]+$'
             group by me.key
          ) x
      ),
      '{}'::jsonb
    ),
    'reviews', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'rating', r.rating,
          'comment', r.comment,
          'criteria', r.criteria,
          'questions', r.questions,
          'assets', to_jsonb(r.assets),
          'response', r.response,
          'responded_at', r.responded_at,
          'client_name', coalesce(
            nullif(au.raw_user_meta_data->>'full_name', ''),
            au.raw_user_meta_data->>'company_name',
            req.client_name
          ),
          'request_type', req.project_type,
          'request_budget', req.budget,
          'created_at', r.created_at
        )
        order by r.created_at desc
      ),
      '[]'::jsonb
    )
  )
  from public.reviews r
  left join public.requests req on req.id = r.request_id
  left join auth.users au on au.id = r.client_id
  where r.developer_id = p_developer
    and coalesce(r.hidden, false) = false;
$$;

-- ---------------------------------------------------------------------------
-- 11. RPC d'administration.
-- ---------------------------------------------------------------------------
-- admin_get_reviews : liste exhaustive des avis (avec ou sans les masqués).
create or replace function public.admin_get_reviews(
  p_visibility text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_visibility text := lower(nullif(btrim(coalesce(p_visibility, '')), ''));
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  if v_visibility is not null and v_visibility not in ('visible', 'hidden') then
    v_visibility := null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', rv.id,
      'rating', rv.rating,
      'comment', rv.comment,
      'criteria', rv.criteria,
      'questions', rv.questions,
      'assets', to_jsonb(rv.assets),
      'hidden', rv.hidden,
      'admin_note', rv.admin_note,
      'response', rv.response,
      'responded_at', rv.responded_at,
      'created_at', rv.created_at,
      'updated_at', rv.updated_at,
      'client_name', coalesce(
        nullif(au.raw_user_meta_data->>'full_name', ''),
        au.raw_user_meta_data->>'company_name',
        req.client_name
      ),
      'client_email', au.email,
      'developer_id', rv.developer_id,
      'developer_name', d.full_name,
      'developer_username', d.username,
      'request_name', req.client_name,
      'request_type', req.project_type,
      'request_budget', req.budget
    ) order by rv.created_at desc
  ), '[]'::jsonb) into v_result
  from public.reviews rv
  left join public.developers d on d.id = rv.developer_id
  left join public.requests req on req.id = rv.request_id
  left join auth.users au on au.id = rv.client_id
  where (v_visibility is null or (rv.hidden = (v_visibility = 'hidden')));

  return v_result;
end;
$$;

-- admin_set_review_status : masquer / restaurer un avis (+ note de modération).
-- Ne modifie JAMAIS la note, le commentaire ni les critères.
create or replace function public.admin_set_review_status(
  p_review_id uuid,
  p_hidden boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.reviews%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  select * into v_review from public.reviews where id = p_review_id;
  if v_review.id is null then
    raise exception 'Avis introuvable.' using errcode = 'TLNOK';
  end if;

  update public.reviews
     set hidden = coalesce(p_hidden, false),
         admin_note = nullif(btrim(coalesce(p_note, '')), ''),
         updated_at = now()
   where id = v_review.id;

  return jsonb_build_object(
    'review_id', v_review.id,
    'hidden', coalesce(p_hidden, false),
    'rating', v_review.rating
  );
end;
$$;

-- admin_list_review_reports : signalements ciblant des avis.
create or replace function public.admin_list_review_reports(
  p_status text default 'open'
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_status text := lower(nullif(btrim(coalesce(p_status, 'open')), ''));
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration.' using errcode = 'TLAAC';
  end if;

  if v_status is null or v_status not in ('open', 'resolved', 'dismissed') then
    v_status := 'open';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', rp.id,
      'reason', rp.reason,
      'description', rp.description,
      'status', rp.status,
      'note', rp.note,
      'penalty', rp.penalty,
      'created_at', rp.created_at,
      'resolved_at', rp.resolved_at,
      'reporter_email', ru.email,
      'review', jsonb_build_object(
        'id', rv.id,
        'rating', rv.rating,
        'comment', rv.comment,
        'hidden', rv.hidden,
        'created_at', rv.created_at
      ),
      'developer_name', d.full_name,
      'developer_username', d.username,
      'request_type', req.project_type,
      'request_budget', req.budget
    ) order by rp.created_at desc
  ), '[]'::jsonb) into v_result
  from public.reports rp
  left join auth.users ru on ru.id = rp.reporter_id
  left join public.reviews rv on rv.id = rp.target_id
  left join public.developers d on d.id = rv.developer_id
  left join public.requests req on req.id = rv.request_id
  where rp.target_type = 'review'
    and rp.status = v_status;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Notification : mission passée à 'terminé' → invite le client à évaluer.
--     Déclenchée par n'importe quel chemin (client, admin…).
-- ---------------------------------------------------------------------------
create or replace function public.tgf_review_request_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'terminé'
     and old.status is distinct from 'terminé'
     and new.client_id is not null
  then
    perform public.notify_user(
      new.client_id,
      'review_requested',
      'Votre mission est terminée — évaluez votre expérience',
      'Vous pouvez maintenant laisser un avis et une note au développeur qui a réalisé votre projet.',
      '/review/' || new.id::text,
      'request',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_review_request_done on public.requests;
create trigger trg_review_request_done
  after update on public.requests
  for each row
  when (new.status = 'terminé' and old.status is distinct from 'terminé')
  execute function public.tgf_review_request_done();

-- ---------------------------------------------------------------------------
-- 13. Droits d'exécution.
-- ---------------------------------------------------------------------------
revoke execute on function public.submit_review(uuid, integer, text, jsonb, jsonb, text[]) from public, anon;
grant execute on function public.submit_review(uuid, integer, text, jsonb, jsonb, text[]) to authenticated;

revoke execute on function public.get_review_for_request(uuid) from public, anon;
grant execute on function public.get_review_for_request(uuid) to authenticated;

revoke execute on function public.get_my_request_reviews() from public, anon;
grant execute on function public.get_my_request_reviews() to authenticated;

revoke execute on function public.list_my_developer_reviews() from public, anon;
grant execute on function public.list_my_developer_reviews() to authenticated;

revoke execute on function public.respond_to_review(uuid, text) from public, anon;
grant execute on function public.respond_to_review(uuid, text) to authenticated;

revoke execute on function public.submit_review_report(uuid, text, text) from public, anon;
grant execute on function public.submit_review_report(uuid, text, text) to authenticated;

grant execute on function public.get_developer_reviews(uuid) to anon, authenticated;

revoke execute on function public.admin_get_reviews(text) from public, anon;
grant execute on function public.admin_get_reviews(text) to authenticated;

revoke execute on function public.admin_set_review_status(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_review_status(uuid, boolean, text) to authenticated;

revoke execute on function public.admin_list_review_reports(text) from public, anon;
grant execute on function public.admin_list_review_reports(text) to authenticated;