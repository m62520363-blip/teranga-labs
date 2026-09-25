-- ============================================================
-- TERANGA LABS — Migration 0005 : paiement en ligne
-- Checkout Wave (Business API) : session de paiement, puis
-- webhook sécurisé qui crédite les Tokens.
--
-- Principe de sécurité :
--   * Aucun crédit n'est possible par un simple clic client.
--   * credit_from_payment n'est exécutable QUE via le
--     service_role (clé serveur) : il est révoqué de
--     public/anon/authenticated.
--   * Idempotent : une intention payée n'est créditée qu'une fois.
-- ============================================================

-- ------------------------------------------------------------
-- payment_intents : allocation de montant créée à l'initiation
-- du paiement. C'est l'unique source de vérité antérieurement
-- au webhook.
-- ------------------------------------------------------------
create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid references public.developers(id) on delete cascade not null,
  package_id text not null,
  package_name text not null,
  tokens integer not null check (tokens > 0),
  amount_fcfa integer not null check (amount_fcfa > 0),
  currency text not null default 'XOF' check (currency = 'XOF'),
  provider text not null default 'wave',
  provider_session_id text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  credited_at timestamptz,
  unique (provider, provider_session_id)
);

create index if not exists payment_intents_developer_idx on public.payment_intents (developer_id);
create index if not exists payment_intents_status_idx on public.payment_intents (status);

alter table public.payment_intents enable row level security;

-- Un développeur voit UNIQUEMENT ses propres intentions de paiement.
create policy "payment_intents_select_own"
  on public.payment_intents for select
  to authenticated
  using (developer_id = auth.uid());

-- La route serveur de checkout crée l'intention pour l'utilisateur connecté.
create policy "payment_intents_insert_own"
  on public.payment_intents for insert
  to authenticated
  with check (developer_id = auth.uid());

-- Aucun update/delete public : seuls le RPC (service_role) et le
-- serveur (service_role) modifient ces lignes.

-- ------------------------------------------------------------
-- credit_from_payment : crédite les Tokens APRÈS vérification
-- par le webhook (signature Wave valide + montant conforme).
-- Exécutable uniquement par le service_role.
--   * Idempotent et atomique : ne crédite qu'un intent 'pending'.
-- ------------------------------------------------------------
create or replace function public.credit_from_payment(p_intent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.payment_intents%rowtype;
  v_updated integer;
  v_new_balance integer;
begin
  -- Seul le service_role peut créditer : les GRANT (fin de fichier) le
  -- garantissent côté PostgREST. Ce garde-fou renforce : toute exécution
  -- sans claim service_role est rejetée, même en contexte utilisateur.
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Accès interdit.' using errcode = 'TLAAC';
  end if;

  select * into v_intent from public.payment_intents where id = p_intent_id;
  if not found then
    raise exception 'Intention de paiement introuvable.' using errcode = 'TLNOR';
  end if;

  if v_intent.status = 'paid' then
    -- Ré-envoi du webhook (retry Wave) : rien à recréditer.
    return jsonb_build_object(
      'credited', false,
      'intent_id', v_intent.id,
      'reason', 'already_credited'
    );
  end if;

  if v_intent.status <> 'pending' then
    raise exception 'Cette intention de paiement n''est pas payable.'
      using errcode = 'TLDUP';
  end if;

  -- Verrou atomique : un seul crédit possible.
  update public.payment_intents
     set status = 'paid', credited_at = now()
   where id = p_intent_id and status = 'pending';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object(
      'credited', false,
      'intent_id', v_intent.id,
      'reason', 'already_credited'
    );
  end if;

  insert into public.token_transactions (developer_id, amount, amount_fcfa, type)
  values (v_intent.developer_id, v_intent.tokens, v_intent.amount_fcfa, 'purchase');

  select coalesce(sum(t.amount), 0)::integer
    into v_new_balance
    from public.token_transactions t
   where t.developer_id = v_intent.developer_id;

  return jsonb_build_object(
    'credited', true,
    'intent_id', v_intent.id,
    'tokens', v_intent.tokens,
    'balance', v_new_balance
  );
end;
$$;

-- Révoquer l'exécution pour le public et les rôles utilisateurs.
revoke execute on function public.credit_from_payment(uuid) from public;
revoke execute on function public.credit_from_payment(uuid) from anon;
revoke execute on function public.credit_from_payment(uuid) from authenticated;

-- Seul le service_role (clé serveur) peut créditer depuis un webhook.
grant execute on function public.credit_from_payment(uuid) to service_role;