-- 0084_qa_results.sql
-- Table pour stocker les résultats des tests QA de manière persistante.

create table if not exists public.qa_results (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  total_tests integer not null default 0,
  passed_tests integer not null default 0,
  failed_tests integer not null default 0,
  avg_score integer not null default 0,
  test_files jsonb not null default '[]'::jsonb,
  summary text,
  triggered_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.qa_results enable row level security;

create policy qa_results_admin_select
  on public.qa_results for select
  to authenticated
  using (public.has_role(array['admin']));

create policy qa_results_admin_insert
  on public.qa_results for insert
  to authenticated
  with check (public.has_role(array['admin']));

create index if not exists qa_results_run_at_idx
  on public.qa_results (run_at desc);

-- RPC pour sauvegarder les résultats
create or replace function public.save_qa_results(
  p_total_tests integer,
  p_passed_tests integer,
  p_failed_tests integer,
  p_avg_score integer,
  p_test_files jsonb,
  p_summary text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if not public.has_role(array['admin']) then
    raise exception 'Accès administrateur requis.' using errcode = 'TLAUT';
  end if;

  insert into public.qa_results (total_tests, passed_tests, failed_tests, avg_score, test_files, summary, triggered_by)
  values (p_total_tests, p_passed_tests, p_failed_tests, p_avg_score, p_test_files, p_summary, v_uid)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.save_qa_results(integer, integer, integer, integer, jsonb, text) to authenticated;

-- RPC pour récupérer les derniers résultats
create or replace function public.get_qa_results(p_limit integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(array['admin']) then
    raise exception 'Accès administrateur requis.' using errcode = 'TLAUT';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'run_at', r.run_at,
        'total_tests', r.total_tests,
        'passed_tests', r.passed_tests,
        'failed_tests', r.failed_tests,
        'avg_score', r.avg_score,
        'test_files', r.test_files,
        'summary', r.summary
      ) order by r.run_at desc
    )
    from public.qa_results r
    limit p_limit
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_qa_results(integer) to authenticated;
