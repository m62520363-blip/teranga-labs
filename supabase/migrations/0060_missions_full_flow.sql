-- ============================================================
-- 0060_missions_full_flow.sql
-- Parcours mission complet : 15 statuts, contrat snapshot,
-- paiement, livraison, acceptation, corrections, annulation,
-- remboursement, litige. Transitions contrôlées côté serveur.
-- NON destructif, idempotent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Colonnes contrat / livraison / annulation
-- ------------------------------------------------------------
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS contract_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS contract_client_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contract_dev_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
  ADD COLUMN IF NOT EXISTS delivery_files JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acceptance_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correction_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount_fcfa INTEGER;

-- ------------------------------------------------------------
-- 2. Statuts étendus (15)
-- ------------------------------------------------------------
ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_status_check;
ALTER TABLE public.missions
  ADD CONSTRAINT missions_status_check
  CHECK (status IN (
    'draft',                 -- brouillon
    'negotiating',           -- négociation en cours
    'awaiting_agreement',    -- en attente d'accord
    'awaiting_payment',      -- en attente de paiement
    'payment_confirmed',     -- paiement confirmé
    'in_progress',           -- en cours
    'delivery_submitted',    -- livraison soumise
    'awaiting_acceptance',   -- en attente d'acceptation
    'corrections_requested', -- corrections demandées
    'dispute_open',          -- litige ouvert
    'completed',             -- terminée
    'cancellation_requested',-- annulation demandée
    'cancelled',             -- annulée
    'refund_in_progress',    -- remboursement en cours
    'refunded',              -- remboursée
    'new',                   -- legacy (migré vers awaiting_payment)
    'disputed'               -- legacy (migré vers dispute_open)
  ));

-- Migration des valeurs legacy.
UPDATE public.missions SET status = 'dispute_open' WHERE status = 'disputed';
UPDATE public.missions SET status = 'awaiting_payment' WHERE status = 'new';
UPDATE public.missions SET status = 'awaiting_acceptance'
 WHERE status = 'completed' AND acceptance_at IS NULL AND completed_at IS NOT NULL;
UPDATE public.missions SET status = 'completed'
 WHERE status = 'awaiting_acceptance' AND acceptance_at IS NOT NULL;

-- ------------------------------------------------------------
-- 3. create_mission_from_offer : contrat snapshot + awaiting_payment
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_mission_from_offer(
  p_offer_id UUID,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_offer public.formal_offers%ROWTYPE;
  v_conv public.conversations%ROWTYPE;
  v_mission_id UUID;
  v_existing UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLNAU';
  END IF;

  SELECT * INTO v_offer FROM public.formal_offers WHERE id = p_offer_id FOR UPDATE;
  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'Offre introuvable.' USING ERRCODE = 'TLNFO';
  END IF;

  SELECT * INTO v_conv FROM public.conversations WHERE id = v_offer.conversation_id;
  IF v_conv.id IS NULL OR v_conv.client_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Seul le client concerné peut créer la mission.' USING ERRCODE = 'TLNOC';
  END IF;

  IF v_offer.status <> 'accepted' THEN
    RAISE EXCEPTION 'Offre non acceptée.' USING ERRCODE = 'TLPEN';
  END IF;

  SELECT id INTO v_existing
    FROM public.missions
   WHERE offer_id = p_offer_id
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Une mission existe déjà pour cette offre.' USING ERRCODE = 'TLDUP';
  END IF;

  INSERT INTO public.missions (
    request_id, conversation_id, offer_id,
    developer_id, client_id,
    agreed_price_fcfa, agreed_days, description,
    status,
    contract_snapshot,
    contract_client_accepted_at,
    contract_dev_accepted_at
  ) VALUES (
    v_conv.request_id, v_conv.id, v_offer.id,
    v_offer.developer_id, v_user_id,
    v_offer.total_price_fcfa, v_offer.delivery_days, p_description,
    'awaiting_payment',
    jsonb_build_object(
      'offer_id', v_offer.id,
      'price_fcfa', v_offer.total_price_fcfa,
      'days', v_offer.delivery_days,
      'deposit_fcfa', v_offer.deposit_fcfa,
      'accepted_at', now()
    ),
    now(),
    now()
  ) RETURNING id INTO v_mission_id;

  UPDATE public.conversations SET status = 'awarded' WHERE id = v_conv.id;

  INSERT INTO public.mission_events (mission_id, actor_id, status_to, comment)
  VALUES (v_mission_id, v_user_id, 'awaiting_payment', 'Mission créée depuis une offre acceptée. En attente de paiement.');

  PERFORM public.notify_user(
    v_offer.developer_id,
    'mission_created',
    'Nouvelle mission à payer',
    'Le client a créé la mission. Elle démarre après confirmation du paiement.',
    '/missions'
  );

  RETURN JSONB_BUILD_OBJECT(
    'mission_id', v_mission_id,
    'status', 'awaiting_payment',
    'developer_id', v_offer.developer_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_mission_from_offer(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_mission_from_offer(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 4. Machine à états complète
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mission_update_status(
  p_mission_id UUID,
  p_to_status TEXT,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_m public.missions%ROWTYPE;
  v_from TEXT;
  v_allowed BOOLEAN := FALSE;
  v_is_client BOOLEAN;
  v_is_dev BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLNAU';
  END IF;

  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.' USING ERRCODE = 'TLNMI';
  END IF;

  v_from := v_m.status;
  v_is_client := (v_m.client_id = v_user_id);
  v_is_dev := (v_m.developer_id = v_user_id);

  -- Règles de transition (rôle strict).
  IF v_from = 'awaiting_payment' AND p_to_status = 'payment_confirmed' THEN
    v_allowed := FALSE; -- uniquement via confirm_mission_payment (webhook)
  ELSIF v_from = 'payment_confirmed' AND p_to_status = 'in_progress' AND v_is_dev THEN
    v_allowed := TRUE;
  ELSIF v_from IN ('in_progress', 'corrections_requested') AND p_to_status = 'delivery_submitted' AND v_is_dev THEN
    v_allowed := TRUE;
  ELSIF v_from IN ('delivery_submitted', 'awaiting_acceptance') AND p_to_status = 'awaiting_acceptance' AND v_is_dev THEN
    v_allowed := TRUE;
  ELSIF v_from = 'awaiting_acceptance' AND p_to_status = 'corrections_requested' AND v_is_client THEN
    v_allowed := TRUE;
  ELSIF v_from = 'corrections_requested' AND p_to_status = 'in_progress' AND v_is_dev THEN
    v_allowed := TRUE;
  ELSIF v_from IN ('awaiting_acceptance', 'delivery_submitted') AND p_to_status = 'completed' AND v_is_client THEN
    v_allowed := TRUE;
  ELSIF v_from IN ('payment_confirmed', 'in_progress', 'delivery_submitted', 'awaiting_acceptance', 'corrections_requested')
        AND p_to_status = 'cancellation_requested' AND (v_is_client OR v_is_dev) THEN
    v_allowed := TRUE;
  ELSIF v_from = 'cancellation_requested' AND p_to_status = 'cancelled' AND (v_is_client OR v_is_dev) THEN
    v_allowed := TRUE;
  ELSIF v_from IN ('payment_confirmed', 'in_progress', 'delivery_submitted', 'awaiting_acceptance', 'corrections_requested')
        AND p_to_status = 'dispute_open' AND (v_is_client OR v_is_dev) THEN
    v_allowed := TRUE;
  ELSIF v_from = 'dispute_open' AND p_to_status = 'completed' THEN
    v_allowed := public.is_admin(); -- résolution admin
  ELSIF v_from IN ('cancellation_requested', 'dispute_open') AND p_to_status = 'refund_in_progress' THEN
    v_allowed := public.is_admin();
  ELSIF v_from = 'refund_in_progress' AND p_to_status = 'refunded' THEN
    v_allowed := public.is_admin();
  ELSIF v_from = 'refund_in_progress' AND p_to_status = 'cancelled' THEN
    v_allowed := public.is_admin();
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transition invalide (' || v_from || ' → ' || p_to_status || ').' USING ERRCODE = 'TLTRN';
  END IF;

  UPDATE public.missions
     SET status = p_to_status,
         started_at = CASE WHEN p_to_status = 'in_progress' THEN COALESCE(started_at, NOW()) ELSE started_at END,
         delivery_at = CASE WHEN p_to_status = 'delivery_submitted' THEN NOW() ELSE delivery_at END,
         acceptance_at = CASE WHEN p_to_status = 'completed' THEN NOW() ELSE acceptance_at END,
         completed_at = CASE WHEN p_to_status = 'completed' THEN NOW() ELSE completed_at END,
         correction_count = CASE WHEN p_to_status = 'corrections_requested' THEN correction_count + 1 ELSE correction_count END
   WHERE id = p_mission_id;

  INSERT INTO public.mission_events (mission_id, actor_id, status_from, status_to, comment)
  VALUES (p_mission_id, v_user_id, v_from, p_to_status, p_comment);

  -- Notifications des parties.
  IF v_is_client THEN
    PERFORM public.notify_user(v_m.developer_id, 'mission_status',
      'Mission ' || p_to_status, coalesce(p_comment, 'Statut de mission mis à jour.'), '/missions');
  ELSE
    PERFORM public.notify_user(v_m.client_id, 'mission_status',
      'Mission ' || p_to_status, coalesce(p_comment, 'Statut de mission mis à jour.'), '/missions');
  END IF;

  -- Libération des fonds à l'acceptation finale.
  IF p_to_status = 'completed' THEN
    PERFORM public.release_mission_funds(p_mission_id);
    -- Points de classement : 50 pts une seule fois.
    UPDATE public.developers
       SET completed_projects_count = coalesce(completed_projects_count, 0) + 1
     WHERE id = v_m.developer_id;
    PERFORM public.notify_user(v_m.developer_id, 'mission_completed',
      'Mission terminée', 'Félicitations, la mission est terminée et les fonds sont disponibles.', '/wallet');
    PERFORM public.notify_user(v_m.client_id, 'mission_completed',
      'Mission terminée', 'La mission est terminée. Vous pouvez laisser un avis.', '/missions');
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'mission_id', p_mission_id,
    'status', p_to_status,
    'was', v_from
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mission_update_status(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mission_update_status(UUID, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 5. Livraison
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mission_submit_delivery(
  p_mission_id uuid,
  p_delivery_url text default null,
  p_delivery_notes text default null,
  p_delivery_files jsonb default '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_m public.missions%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL OR v_m.developer_id <> v_user THEN
    RAISE EXCEPTION 'Mission non trouvable.' USING ERRCODE = 'TLNMI';
  END IF;
  IF v_m.status NOT IN ('in_progress', 'corrections_requested') THEN
    RAISE EXCEPTION 'La mission n''est pas en cours.' USING ERRCODE = 'TLSTS';
  END IF;
  IF nullif(btrim(coalesce(p_delivery_url, '')), '') IS NULL
     AND coalesce(jsonb_array_length(p_delivery_files), 0) = 0 THEN
    RAISE EXCEPTION 'Fournissez un lien de livraison ou des fichiers.' USING ERRCODE = 'TLBAD';
  END IF;

  UPDATE public.missions
     SET delivery_url = nullif(btrim(coalesce(p_delivery_url, '')), ''),
         delivery_notes = nullif(btrim(coalesce(p_delivery_notes, '')), ''),
         delivery_files = coalesce(p_delivery_files, '[]'::jsonb),
         delivery_at = now(),
         status = 'awaiting_acceptance'
   WHERE id = p_mission_id;

  INSERT INTO public.mission_events (mission_id, actor_id, status_from, status_to, comment)
  VALUES (p_mission_id, v_user, v_m.status, 'awaiting_acceptance', 'Livraison soumise.');

  PERFORM public.notify_user(
    v_m.client_id,
    'delivery_submitted',
    'Livraison soumise',
    'Le développeur a soumis la livraison de la mission. Vérifiez et acceptez ou demandez des corrections.',
    '/missions'
  );

  RETURN jsonb_build_object('ok', true, 'status', 'awaiting_acceptance');
END;
$$;

REVOKE ALL ON FUNCTION public.mission_submit_delivery(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mission_submit_delivery(uuid, text, text, jsonb) TO authenticated;

-- ------------------------------------------------------------
-- 6. Annulation + remboursement
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mission_request_cancellation(
  p_mission_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_m public.missions%ROWTYPE;
  v_paid integer;
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLAUT';
  END IF;
  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL OR (v_m.client_id <> v_user AND v_m.developer_id <> v_user) THEN
    RAISE EXCEPTION 'Mission non trouvable.' USING ERRCODE = 'TLNMI';
  END IF;
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Un motif d''annulation est requis.' USING ERRCODE = 'TLBAD';
  END IF;

  v_result := public.mission_update_status(p_mission_id, 'cancellation_requested', btrim(p_reason));

  UPDATE public.missions SET cancellation_reason = btrim(p_reason) WHERE id = p_mission_id;

  -- Travail non commencé + paiement confirmé → remboursement intégral
  -- proposé (exécution admin du remboursement Chariow).
  SELECT coalesce(sum(amount_fcfa), 0) INTO v_paid
    FROM public.mission_payments
   WHERE mission_id = p_mission_id AND status = 'confirmed';

  IF v_m.status IN ('payment_confirmed') AND v_paid > 0 THEN
    UPDATE public.missions SET refund_amount_fcfa = v_paid, status = 'refund_in_progress'
     WHERE id = p_mission_id;
    INSERT INTO public.mission_events (mission_id, actor_id, status_from, status_to, comment)
    VALUES (p_mission_id, v_user, 'cancellation_requested', 'refund_in_progress',
            'Annulation avant démarrage : remboursement intégral proposé.');
    v_result := v_result || jsonb_build_object('refund_proposed', v_paid);
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.mission_request_cancellation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mission_request_cancellation(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_process_mission_refund(
  p_mission_id uuid,
  p_refund_amount_fcfa integer,
  p_note text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m public.missions%ROWTYPE;
  v_payment public.mission_payments%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès administrateur requis.' USING ERRCODE = 'TLAUT';
  END IF;
  SELECT * INTO v_m FROM public.missions WHERE id = p_mission_id FOR UPDATE;
  IF v_m.id IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable.' USING ERRCODE = 'TLNMI';
  END IF;
  IF v_m.status NOT IN ('refund_in_progress', 'cancellation_requested', 'dispute_open') THEN
    RAISE EXCEPTION 'Statut incompatible avec un remboursement.' USING ERRCODE = 'TLSTS';
  END IF;

  SELECT * INTO v_payment
    FROM public.mission_payments
   WHERE mission_id = p_mission_id AND status = 'confirmed'
   LIMIT 1
   FOR UPDATE;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Aucun paiement confirmé à rembourser.' USING ERRCODE = 'TLNPD';
  END IF;
  IF coalesce(p_refund_amount_fcfa, 0) <= 0 OR p_refund_amount_fcfa > v_payment.amount_fcfa THEN
    RAISE EXCEPTION 'Montant de remboursement invalide.' USING ERRCODE = 'TLBAD';
  END IF;

  -- Ne marque refunded qu'après exécution réelle côté Chariow/admin.
  UPDATE public.mission_payments
     SET status = 'refunded', refunded_at = now()
   WHERE id = v_payment.id;

  -- Annule la ligne de revenus en attente si présente.
  INSERT INTO public.earnings_ledger (developer_id, mission_id, amount_fcfa, kind, note)
  VALUES (v_m.developer_id, p_mission_id, -p_refund_amount_fcfa, 'refund',
          coalesce(p_note, 'Remboursement client'))
  ON CONFLICT (mission_id, kind) WHERE mission_id IS NOT NULL AND kind IN ('pending', 'available')
  DO NOTHING;

  UPDATE public.missions
     SET status = 'refunded',
         refund_amount_fcfa = p_refund_amount_fcfa,
         completed_at = NULL
   WHERE id = p_mission_id;

  INSERT INTO public.mission_events (mission_id, actor_id, status_from, status_to, comment)
  VALUES (p_mission_id, auth.uid(), v_m.status, 'refunded',
          'Remboursement de ' || p_refund_amount_fcfa || ' FCFA exécuté.');

  PERFORM public.notify_user(v_m.client_id, 'refund_completed',
    'Remboursement effectué', 'Votre remboursement de ' || p_refund_amount_fcfa || ' FCFA a été traité.', '/missions');
  PERFORM public.notify_user(v_m.developer_id, 'mission_cancelled',
    'Mission annulée', 'La mission a été annulée et remboursée.', '/missions');

  RETURN jsonb_build_object('ok', true, 'refunded_fcfa', p_refund_amount_fcfa);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_process_mission_refund(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_process_mission_refund(uuid, integer, text) TO authenticated;

COMMIT;
