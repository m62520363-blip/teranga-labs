-- ============================================================
-- TERANGA LABS — Migration 0010 : correctif get_public_developer_profile
-- skills est de type text[] et ne se caste pas en jsonb
-- (to_jsonb(text[]) produit bien un tableau JSON de chaînes).
-- ============================================================

create or replace function public.get_public_developer_profile(
  p_identifier text
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_identifier text := nullif(btrim(p_identifier), '');
  v_dev public.developers%rowtype;
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
    'portfolio_links', coalesce(v_dev.portfolio_links, '[]'::jsonb),
    'projects_count', (
      select count(*)::integer from public.unlocks u
       where u.developer_id = v_dev.id
    ),
    'review_count', (
      select count(*)::integer from public.reviews r
       where r.developer_id = v_dev.id
    ),
    'review_average', (
      select round(coalesce(avg(r.rating), 0), 1)::numeric
        from public.reviews r
       where r.developer_id = v_dev.id
    ),
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
        and r.rating >= 3
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_public_developer_profile(text) to anon, authenticated;