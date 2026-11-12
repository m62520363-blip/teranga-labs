-- 0088_mutual_reviews.sql
-- Ajout de la notation mutuelle (développeur note le client).

-- 1. Ajouter le type de reviewer
alter table public.reviews
  add column if not exists reviewer_type text not null default 'client'
  check (reviewer_type in ('client', 'developer'));

-- 2. Modifier la contrainte unique pour permettre les deux types
alter table public.reviews
  drop constraint if exists reviews_request_id_developer_id_key;

alter table public.reviews
  add constraint reviews_request_developer_type_unique
  unique (request_id, developer_id, reviewer_type);

-- 3. RPC pour qu'un développeur note un client
create or replace function public.submit_developer_review(
  p_request_id uuid,
  p_rating integer,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_req public.requests%rowtype;
  v_review_id uuid;
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour laisser un avis.' using errcode = 'TLNAU';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Note invalide (1 à 5).' using errcode = 'TLBAD';
  end if;

  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'Mission introuvable.' using errcode = 'TLNOK';
  end if;

  -- Seul le développeur assigné à la mission peut noter le client
  if not exists (
    select 1 from public.missions
    where request_id = p_request_id and developer_id = v_uid
  ) then
    raise exception 'Seul le développeur de la mission peut déposer cet avis.' using errcode = 'TLFOR';
  end if;

  -- Upsert : un avis par (request, developer, type)
  insert into public.reviews (developer_id, request_id, rating, comment, reviewer_type)
  values (v_uid, p_request_id, p_rating, p_comment, 'developer')
  on conflict (request_id, developer_id, reviewer_type) do update
    set rating = excluded.rating,
        comment = excluded.comment,
        updated_at = now()
  returning id into v_review_id;

  return jsonb_build_object('ok', true, 'review_id', v_review_id);
end;
$$;

grant execute on function public.submit_developer_review(uuid, integer, text) to authenticated;

-- 4. RPC pour récupérer les avis d'un client
create or replace function public.get_client_reviews(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'rating', r.rating,
        'comment', r.comment,
        'created_at', r.created_at,
        'reviewer_type', r.reviewer_type
      )
      order by r.created_at desc
    )
    from public.reviews r
    where r.request_id in (select id from public.requests where client_id = p_client_id)
      and r.reviewer_type = 'developer'
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_client_reviews(uuid) to authenticated;
