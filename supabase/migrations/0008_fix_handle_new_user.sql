-- ============================================================
-- TERANGA LABS — Migration 0008 : correctif handle_new_user
-- jsonb_array_to_text_array() n'existe pas en Postgres standard :
-- toute inscription avec un tableau de compétences échouait.
-- Remplacé par jsonb_array_elements_text() + array_agg().
-- create or replace → idempotent.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

  return new;
end;
$$;