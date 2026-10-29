-- ============================================================
-- 0059_earnings_withdrawals.sql
-- Wallet étendu : revenus de missions (en attente / disponibles),
-- retraits tracés. Les Tokens restent gérés par token_transactions.
-- Le séquestre des fonds mission est un LIVRE COMPTABLE INTERNE
-- alimenté par des paiements Chariow confirmés côté serveur —
-- pas une simulation. Aucun solde négatif, idempotence par clé.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Paiements de missions (confirmés via webhook Chariow)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mission_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_fcfa INTEGER NOT NULL CHECK (amount_fcfa > 0),
  currency TEXT NOT NULL DEFAULT 'XOF',
  provider TEXT NOT NULL DEFAULT 'chariow',
  provider_sale_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'refunding', 'refunded', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  UNIQUE (provider, provider_sale_id)
);

CREATE INDEX IF NOT EXISTS mission_payments_mission_idx ON public.mission_payments (mission_id, status);
ALTER TABLE public.mission_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mission_payments_participant_select ON public.mission_payments;
CREATE POLICY mission_payments_participant_select ON public.mission_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.missions m
       WHERE m.id = mission_payments.mission_id
         AND (m.developer_id = auth.uid() OR m.client_id = auth.uid())
    )
  );

-- Écriture exclusivement via RPC (webhook service_role).

-- ------------------------------------------------------------
-- 2. Grand livre des revenus développeur
--    kind : pending (fonds bloqués) → available (retirables)
--           withdrawal_hold / withdrawal_paid / refund / adjustment
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.earnings_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
  withdrawal_id UUID,
  amount_fcfa INTEGER NOT NULL,
  kind TEXT NOT NULL
    CHECK (kind IN ('pending', 'available', 'withdrawal_hold', 'withdrawal_paid', 'refund', 'adjustment')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS earnings_ledger_developer_idx ON public.earnings_ledger (developer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS earnings_ledger_mission_idx ON public.earnings_ledger (mission_id);
CREATE UNIQUE INDEX IF NOT EXISTS earnings_ledger_mission_kind_uidx
  ON public.earnings_ledger (mission_id, kind)
  WHERE mission_id IS NOT NULL AND kind IN ('pending', 'available');

ALTER TABLE public.earnings_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS earnings_ledger_select_own ON public.earnings_ledger;
CREATE POLICY earnings_ledger_select_own ON public.earnings_ledger
  FOR SELECT TO authenticated USING (developer_id = auth.uid());

-- ------------------------------------------------------------
-- 3. Retraits
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_fcfa INTEGER NOT NULL CHECK (amount_fcfa > 0),
  method TEXT NOT NULL CHECK (method IN ('wave', 'orange_money', 'mobicash', 'bank_transfer')),
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'processing', 'paid', 'rejected', 'cancelled')),
  provider_reference TEXT,
  admin_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS withdrawals_developer_idx ON public.withdrawals (developer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON public.withdrawals (status);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS withdrawals_select_own ON public.withdrawals;
CREATE POLICY withdrawals_select_own ON public.withdrawals
  FOR SELECT TO authenticated USING (developer_id = auth.uid());

REVOKE ALL ON public.withdrawals FROM PUBLIC, anon;
REVOKE ALL ON public.earnings_ledger FROM PUBLIC, anon;
REVOKE ALL ON public.mission_payments FROM PUBLIC, anon;

-- ------------------------------------------------------------
-- 4. Confirmation d'un paiement de mission (service_role / webhook)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_mission_payment(
  p_mission_id UUID,
  p_provider_sale_id TEXT,
  p_amount_fcfa INTEGER,
  p_payer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m public.missions%ROWTYPE;
  v_existing public.mission_payments%ROWTYPE;
  v_payer uuid;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès interdit.' USING ERRCODE = 'TLAAC';
  END IF;

  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.' USING ERRCODE = 'TLNMI';
  END IF;

  -- Idempotence : même sale = même résultat.
  SELECT * INTO v_existing
    FROM public.mission_payments
   WHERE provider = 'chariow' AND provider_sale_id = p_provider_sale_id;
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'payment_id', v_existing.id);
  END IF;

  IF p_amount_fcfa IS NULL OR p_amount_fcfa <> v_m.agreed_price_fcfa THEN
    RAISE EXCEPTION 'Montant du paiement incohérent avec la mission.' USING ERRCODE = 'TLAMT';
  END IF;
  IF v_m.status NOT IN ('awaiting_payment', 'payment_confirmed') THEN
    RAISE EXCEPTION 'La mission n''attend pas de paiement.' USING ERRCODE = 'TLSTS';
  END IF;

  v_payer := coalesce(p_payer_id, v_m.client_id);

  INSERT INTO public.mission_payments (
    mission_id, payer_id, amount_fcfa, provider, provider_sale_id, status, confirmed_at
  ) VALUES (
    p_mission_id, v_payer, p_amount_fcfa, 'chariow', p_provider_sale_id, 'confirmed', now()
  ) RETURNING id INTO v_existing;

  INSERT INTO public.earnings_ledger (developer_id, mission_id, amount_fcfa, kind, note)
  VALUES (v_m.developer_id, p_mission_id, p_amount_fcfa, 'pending', 'Paiement mission confirmé')
  ON CONFLICT (mission_id, kind) WHERE mission_id IS NOT NULL AND kind IN ('pending', 'available')
  DO NOTHING;

  IF v_m.status = 'awaiting_payment' THEN
    UPDATE public.missions SET status = 'payment_confirmed' WHERE id = p_mission_id;
    INSERT INTO public.mission_events (mission_id, actor_id, status_from, status_to, comment)
    VALUES (p_mission_id, v_payer, 'awaiting_payment', 'payment_confirmed', 'Paiement confirmé par le prestataire.');
  END IF;

  PERFORM public.notify_user(
    v_m.developer_id,
    'payment_confirmed',
    'Paiement de mission confirmé',
    'Le client a payé la mission. Vous pouvez démarrer le travail.',
    '/missions'
  );

  RETURN jsonb_build_object('ok', true, 'payment_id', v_existing.id, 'mission_status', 'payment_confirmed');
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_mission_payment(UUID, TEXT, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_mission_payment(UUID, TEXT, INTEGER, UUID) TO service_role;

-- ------------------------------------------------------------
-- 5. Libération des fonds (mission terminée, une seule fois)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_mission_funds(p_mission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m public.missions%ROWTYPE;
  v_amount integer;
  v_actor uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
BEGIN
  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.' USING ERRCODE = 'TLNMI';
  END IF;
  IF v_m.status <> 'completed' THEN
    RAISE EXCEPTION 'Mission non terminée.' USING ERRCODE = 'TLSTS';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.disputes d
     WHERE d.mission_id = p_mission_id AND d.status IN ('open', 'under_review')
  ) THEN
    RAISE EXCEPTION 'Litige en cours : libération bloquée.' USING ERRCODE = 'TLDSP';
  END IF;

  SELECT amount_fcfa INTO v_amount
    FROM public.mission_payments
   WHERE mission_id = p_mission_id AND status = 'confirmed'
   LIMIT 1;

  IF v_amount IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'released', 0, 'reason', 'no_confirmed_payment');
  END IF;

  INSERT INTO public.earnings_ledger (developer_id, mission_id, amount_fcfa, kind, note)
  VALUES (v_m.developer_id, p_mission_id, v_amount, 'available', 'Fonds libérés après acceptation')
  ON CONFLICT (mission_id, kind) WHERE mission_id IS NOT NULL AND kind IN ('pending', 'available')
  DO NOTHING;

  PERFORM public.notify_user(
    v_m.developer_id,
    'earnings_available',
    'Revenus disponibles',
    'Les fonds de la mission sont maintenant disponibles au retrait dans votre wallet.',
    '/wallet'
  );

  RETURN jsonb_build_object('ok', true, 'released', v_amount);
END;
$$;

REVOKE ALL ON FUNCTION public.release_mission_funds(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_mission_funds(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 6. Solde retirable + résumé wallet
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_wallet_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_tokens integer;
  v_pending integer;
  v_available integer;
  v_held integer;
  v_paid integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;

  SELECT coalesce(sum(t.amount), 0)::integer INTO v_tokens
    FROM public.token_transactions t WHERE t.developer_id = v_user;

  SELECT
    coalesce(sum(amount) FILTER (WHERE kind = 'pending'), 0),
    coalesce(sum(amount) FILTER (WHERE kind = 'available'), 0),
    coalesce(-sum(amount) FILTER (WHERE kind = 'withdrawal_hold'), 0),
    coalesce(sum(amount) FILTER (WHERE kind = 'withdrawal_paid'), 0)
  INTO v_pending, v_available, v_held, v_paid
    FROM public.earnings_ledger
   WHERE developer_id = v_user;

  RETURN jsonb_build_object(
    'tokens', v_tokens,
    'earnings_pending_fcfa', v_pending,
    'earnings_available_fcfa', greatest(v_available - v_held, 0),
    'earnings_held_fcfa', v_held,
    'earnings_paid_fcfa', v_paid,
    'min_withdrawal_fcfa', coalesce(
      (select (value #>> '{}')::integer from public.app_settings where key = 'min_withdrawal_fcfa'),
      5000
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_wallet_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wallet_summary() TO authenticated;

-- ------------------------------------------------------------
-- 7. Demande de retrait (réserve immédiate du montant)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount_fcfa integer,
  p_method text,
  p_destination text
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_available integer;
  v_held integer;
  v_min integer;
  v_wid uuid;
  v_dest text := btrim(coalesce(p_destination, ''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  IF p_method NOT IN ('wave', 'orange_money', 'mobicash', 'bank_transfer') THEN
    RAISE EXCEPTION 'Moyen de retrait non pris en charge.' USING ERRCODE = 'TLBAD';
  END IF;
  IF length(v_dest) < 4 OR length(v_dest) > 120 THEN
    RAISE EXCEPTION 'Coordonnées de retrait invalides.' USING ERRCODE = 'TLBAD';
  END IF;
  IF coalesce(p_amount_fcfa, 0) <= 0 THEN
    RAISE EXCEPTION 'Montant invalide.' USING ERRCODE = 'TLBAD';
  END IF;

  v_min := coalesce(
    (select (value #>> '{}')::integer from public.app_settings where key = 'min_withdrawal_fcfa'),
    5000
  );
  IF p_amount_fcfa < v_min THEN
    -- RAISE EXCEPTION n'accepte pas la concatenation "||" en Postgres :
    -- on utilise le placeholder "%" de RAISE.
    RAISE EXCEPTION 'Montant minimum de retrait : % FCFA.', v_min USING ERRCODE = 'TLBAD';
  END IF;

  PERFORM 1 FROM public.user_presence WHERE user_id = v_user;

  SELECT
    coalesce(sum(amount) FILTER (WHERE kind = 'available'), 0),
    coalesce(-sum(amount) FILTER (WHERE kind = 'withdrawal_hold'), 0)
  INTO v_available, v_held
    FROM public.earnings_ledger
   WHERE developer_id = v_user;

  IF (v_available - v_held) < p_amount_fcfa THEN
    RAISE EXCEPTION 'Solde disponible insuffisant pour ce retrait.' USING ERRCODE = 'TLLOW';
  END IF;

  INSERT INTO public.withdrawals (developer_id, amount_fcfa, method, destination, status)
  VALUES (v_user, p_amount_fcfa, p_method, v_dest, 'requested')
  RETURNING id INTO v_wid;

  INSERT INTO public.earnings_ledger (developer_id, withdrawal_id, amount_fcfa, kind, note)
  VALUES (v_user, v_wid, -p_amount_fcfa, 'withdrawal_hold', 'Retrait demandé');

  PERFORM public.notify_user(
    v_user,
    'withdrawal_requested',
    'Demande de retrait enregistrée',
    'Votre demande de retrait de ' || p_amount_fcfa || ' FCFA est en cours de traitement.',
    '/wallet'
  );

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', v_wid, 'amount_fcfa', p_amount_fcfa);
END;
$$;

REVOKE ALL ON FUNCTION public.request_withdrawal(integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(integer, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 8. Traitement admin d'un retrait
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_withdrawal_status(
  p_withdrawal_id uuid,
  p_status text,
  p_provider_reference text default null,
  p_admin_note text default null
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_w public.withdrawals%ROWTYPE;
  v_transition_ok boolean := false;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès administrateur requis.' USING ERRCODE = 'TLAUT';
  END IF;
  IF p_status NOT IN ('approved', 'processing', 'paid', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Statut invalide.' USING ERRCODE = 'TLBAD';
  END IF;

  SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF v_w.id IS NULL THEN
    RAISE EXCEPTION 'Retrait introuvable.' USING ERRCODE = 'TLNWD';
  END IF;

  v_transition_ok :=
       (v_w.status = 'requested' AND p_status IN ('approved', 'rejected', 'cancelled'))
    OR (v_w.status = 'approved' AND p_status IN ('processing', 'paid', 'rejected'))
    OR (v_w.status = 'processing' AND p_status IN ('paid', 'rejected'));

  IF NOT v_transition_ok THEN
    RAISE EXCEPTION 'Transition de statut invalide.' USING ERRCODE = 'TLTRN';
  END IF;

  UPDATE public.withdrawals
     SET status = p_status,
         provider_reference = coalesce(p_provider_reference, provider_reference),
         admin_note = coalesce(p_admin_note, admin_note),
         processed_at = CASE WHEN p_status IN ('paid', 'rejected', 'cancelled') THEN now() ELSE processed_at END
   WHERE id = p_withdrawal_id;

  IF p_status = 'paid' THEN
    INSERT INTO public.earnings_ledger (developer_id, withdrawal_id, amount_fcfa, kind, note)
    VALUES (v_w.developer_id, v_w.id, -v_w.amount_fcfa, 'withdrawal_paid', 'Retrait versé');
    -- Le hold devient paid : on neutralise le hold en encaissant.
    PERFORM public.notify_user(
      v_w.developer_id,
      'withdrawal_paid',
      'Retrait effectué',
      'Votre retrait de ' || v_w.amount_fcfa || ' FCFA a été versé.',
      '/wallet'
    );
  ELSIF p_status IN ('rejected', 'cancelled') THEN
    -- Libère la réserve.
    INSERT INTO public.earnings_ledger (developer_id, withdrawal_id, amount_fcfa, kind, note)
    VALUES (v_w.developer_id, v_w.id, v_w.amount_fcfa, 'adjustment', 'Retrait annulé : fonds libérés');
    PERFORM public.notify_user(
      v_w.developer_id,
      'withdrawal_rejected',
      'Retrait non retenu',
      'Votre demande de retrait a été refusée. Les fonds sont de nouveau disponibles.',
      '/wallet'
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_withdrawal_status(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_withdrawal_status(uuid, text, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 9. Historique wallet enrichi (tokens + revenus)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_wallet_history(p_limit integer default 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  RETURN jsonb_build_object(
    'tokens', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc)
      from (
        select jsonb_build_object(
          'id', t.id,
          'amount', t.amount,
          'type', t.type,
          'amount_fcfa', t.amount_fcfa,
          'request_id', t.request_id,
          'created_at', t.created_at
        ) as x
        from public.token_transactions t
        where t.developer_id = v_user
        order by t.created_at desc
        limit greatest(1, least(coalesce(p_limit, 50), 200))
      ) sub
    ), '[]'::jsonb),
    'earnings', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc)
      from (
        select jsonb_build_object(
          'id', e.id,
          'mission_id', e.mission_id,
          'withdrawal_id', e.withdrawal_id,
          'amount_fcfa', e.amount_fcfa,
          'kind', e.kind,
          'note', e.note,
          'created_at', e.created_at
        ) as x
        from public.earnings_ledger e
        where e.developer_id = v_user
        order by e.created_at desc
        limit greatest(1, least(coalesce(p_limit, 50), 200))
      ) sub
    ), '[]'::jsonb),
    'withdrawals', coalesce((
      select jsonb_agg(x order by x->>'requested_at' desc)
      from (
        select jsonb_build_object(
          'id', w.id,
          'amount_fcfa', w.amount_fcfa,
          'method', w.method,
          'destination_masked', case
            when length(w.destination) > 6
              then left(w.destination, 3) || '…' || right(w.destination, 3)
            else '***' end,
          'status', w.status,
          'provider_reference', w.provider_reference,
          'requested_at', w.requested_at,
          'processed_at', w.processed_at
        ) as x
        from public.withdrawals w
        where w.developer_id = v_user
        order by w.requested_at desc
        limit greatest(1, least(coalesce(p_limit, 50), 100))
      ) sub
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_wallet_history(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wallet_history(integer) TO authenticated;

COMMIT;
