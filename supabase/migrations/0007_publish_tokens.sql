-- ============================================================
-- 0007 : La publication d'un brief coûte désormais 1 Token.
--   - La RPC create_brief (anonyme) est révoquée.
--   - publish_brief : auteur connecté + solde >= 1 + débit -1.
-- Exécuter après 0006 (ordre numérique = ordre d'exécution).
-- ============================================================

-- Autoriser le type 'publish' dans les transactions de tokens.
alter table public.token_transactions
  drop constraint if exists token_transactions_type_check;

alter table public.token_transactions
  add constraint token_transactions_type_check
  check (type in ('purchase', 'unlock', 'bonus', 'publish'));

-- ------------------------------------------------------------
-- publish_brief : publication payante (1 Token), idempotente par
-- appel, atomicité dans la même transaction que le débit.
-- ------------------------------------------------------------
create or replace function public.publish_brief(
  p_client_name text,
  p_client_whatsapp text,
  p_client_city text,
  p_project_type text,
  p_budget integer,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_req public.requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour publier un brief.' using errcode = 'TLAUTH';
  end if;

  if p_client_name is null or length(btrim(p_client_name)) < 2 then
    raise exception 'Nom du client manquant.' using errcode = 'TLBAD';
  end if;
  if p_client_whatsapp is null or p_client_whatsapp = '' then
    raise exception 'Numéro WhatsApp manquant.' using errcode = 'TLBAD';
  end if;
  if p_budget is null or p_budget < 10000 then
    raise exception 'Budget invalide (minimum 10000 F).' using errcode = 'TLBAD';
  end if;
  if p_project_type not in ('vitrine', 'e-commerce', 'landing page', 'app web') then
    raise exception 'Type de projet invalide.' using errcode = 'TLBAD';
  end if;

  select coalesce(sum(t.amount), 0)::integer into v_balance
    from public.token_transactions t
    where t.developer_id = v_user_id;

  if v_balance < 1 then
    raise exception 'Tokens insuffisants. Rechargez vos Tokens pour publier un brief (1 Token).' using errcode = 'TLLOW';
  end if;

  -- Verrou anti-concours : deux publications simultanées ne peuvent pas
  -- toutes les deux dépenser le dernier token.
  perform 1 from public.developers where id = v_user_id for update;

  insert into public.requests (
    client_name, client_whatsapp, client_city, project_type, budget, description
  ) values (
    p_client_name,
    p_client_whatsapp,
    p_client_city,
    p_project_type,
    p_budget,
    p_description
  )
  returning * into v_req;

  insert into public.token_transactions (developer_id, amount, type, request_id)
  values (v_user_id, -1, 'publish', v_req.id);

  return jsonb_build_object(
    'id', v_req.id,
    'management_key', v_req.management_key
  );
end;
$$;

-- Revoke de l'ancienne publication anonyme (contournement impossible).
revoke execute on function public.create_brief(text, text, text, text, integer, text) from anon, authenticated;

-- La nouvelle publication exige une session.
grant execute on function public.publish_brief(text, text, text, text, integer, text) to authenticated;