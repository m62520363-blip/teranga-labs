-- ============================================================
-- 0051_admin_console_sync.sql
-- P5 — Synchronisation console admin (audit R4) : les modules
-- P2/P4 (agences, sponsoring, PRO, litiges, support, flags,
-- risque) n'avaient pas de RPC de lecture côté console. NON
-- destructif.
--
-- Conventions : SECURITY DEFINER + search_path, garde is_admin()
-- dans le corps, REVOKE PUBLIC + GRANT authenticated (session
-- admin de la console), écritures staff via RPC dédiées.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. admin_alerts étendu : + litiges ouverts + tickets ouverts
--    (les 4 compteurs historiques sont inchangés).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_alerts()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'pending_applications', (
      SELECT COUNT(*)::INTEGER FROM public.developers WHERE status = 'pending'
    ),
    'changes_requested', (
      SELECT COUNT(*)::INTEGER FROM public.developers WHERE status = 'changes_requested'
    ),
    'pending_verifications', (
      SELECT COUNT(*)::INTEGER FROM public.verification_requests
       WHERE payment_status = 'confirmed' AND verification_status = 'pending'
    ),
    'pending_payments', (
      SELECT COUNT(*)::INTEGER FROM public.verification_requests
       WHERE payment_status = 'pending'
    ),
    'open_disputes', (
      SELECT COUNT(*)::INTEGER FROM public.disputes
       WHERE status IN ('open', 'under_review')
    ),
    'open_support', (
      SELECT COUNT(*)::INTEGER FROM public.support_tickets WHERE status = 'open'
    ),
    'verification_price_fcfa', public.get_verification_price(),
    'contact_cost_tokens', public.get_contact_cost()
  );
END;
$$;

-- ------------------------------------------------------------
-- 2. admin_list_disputes : litiges + contexte mission/brief.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_disputes(p_status TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN COALESCE((
    SELECT JSONB_AGG(d ORDER BY d.created_at DESC)
    FROM (
      SELECT di.id, di.mission_id, di.reason, di.status, di.resolution,
             di.created_at, di.resolved_at,
             m.agreed_price_fcfa, m.agreed_days,
             r.project_type,
             LEFT(COALESCE(r.description, ''), 120) AS brief_excerpt,
             (SELECT COALESCE(dv.full_name, '—') FROM public.developers dv
               WHERE dv.id = m.developer_id) AS developer_name,
             (SELECT COALESCE(cp.contact_name, cp.company_name, '—')
                FROM public.client_profiles cp
               WHERE cp.id = m.client_id) AS client_name
        FROM public.disputes di
        JOIN public.missions m ON m.id = di.mission_id
        LEFT JOIN public.requests r ON r.id = m.request_id
       WHERE p_status IS NULL OR di.status = p_status
    ) d
  ), '[]'::JSONB);
END;
$$;

-- ------------------------------------------------------------
-- 3. admin_list_support_tickets : tickets + dernier message,
--    auteur masqué (mask_email).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_support_tickets(p_status TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN COALESCE((
    SELECT JSONB_AGG(t ORDER BY t.updated_at DESC)
    FROM (
      SELECT st.id, st.subject, st.status, st.created_at, st.updated_at,
             st.user_id,
             public.mask_email(au.email) AS user_email,
             (SELECT COUNT(*) FROM public.support_messages sm
               WHERE sm.ticket_id = st.id) AS message_count,
             (SELECT JSONB_BUILD_OBJECT(
                       'body', sm.body,
                       'is_staff', sm.is_staff,
                       'created_at', sm.created_at
                     )
                FROM public.support_messages sm
               WHERE sm.ticket_id = st.id
               ORDER BY sm.created_at DESC LIMIT 1) AS last_message
        FROM public.support_tickets st
        JOIN auth.users au ON au.id = st.user_id
       WHERE p_status IS NULL OR st.status = p_status
    ) t
  ), '[]'::JSONB);
END;
$$;

-- ------------------------------------------------------------
-- 4. Réponses staff : + fermeture admin + lecture conversation.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_support_messages(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN COALESCE((
    SELECT JSONB_AGG(m ORDER BY m.created_at)
    FROM (
      SELECT sm.id, sm.author_id, sm.is_staff, sm.body, sm.created_at
        FROM public.support_messages sm
       WHERE sm.ticket_id = p_ticket_id
    ) m
  ), '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reply_support_ticket(
  p_ticket_id UUID,
  p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_body TEXT := NULLIF(TRIM(COALESCE(p_body, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;
  IF v_body IS NULL OR LENGTH(v_body) < 2 THEN
    RAISE EXCEPTION 'Message trop court.' USING ERRCODE = 'TLBAD';
  END IF;
  IF LENGTH(v_body) > 4000 THEN
    RAISE EXCEPTION 'Message trop long (4000 caractères maximum).' USING ERRCODE = 'TLBAD';
  END IF;

  UPDATE public.support_tickets
     SET status = 'answered', updated_at = NOW()
   WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable.' USING ERRCODE = 'TLNOD';
  END IF;

  INSERT INTO public.support_messages (ticket_id, author_id, is_staff, body)
  VALUES (p_ticket_id, v_admin, TRUE, v_body);

  RETURN JSONB_BUILD_OBJECT('id', p_ticket_id, 'status', 'answered');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_close_support_ticket(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  UPDATE public.support_tickets
     SET status = 'closed', updated_at = NOW()
   WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable.' USING ERRCODE = 'TLNOD';
  END IF;

  RETURN JSONB_BUILD_OBJECT('id', p_ticket_id, 'status', 'closed');
END;
$$;

-- ------------------------------------------------------------
-- 5. admin_list_agences : annuaire admin + effectifs.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_agencies(p_status TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN COALESCE((
    SELECT JSONB_AGG(a ORDER BY a.created_at DESC)
    FROM (
      SELECT ag.id, ag.name, ag.slug, ag.status, ag.city, ag.country,
             ag.created_at,
             (SELECT COUNT(*) FROM public.agency_members am
               WHERE am.agency_id = ag.id) AS member_count
        FROM public.agencies ag
       WHERE p_status IS NULL OR ag.status = p_status
    ) a
  ), '[]'::JSONB);
END;
$$;

-- ------------------------------------------------------------
-- 6. Croissance : sponsoring actif, PRO actif, tarifs, flags.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_sponsored()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'profiles', COALESCE((
      SELECT JSONB_AGG(p ORDER BY p.ends_at DESC)
      FROM (
        SELECT sp.developer_id, sp.started_at, sp.ends_at,
               (SELECT COALESCE(dv.full_name, '—') FROM public.developers dv
                 WHERE dv.id = sp.developer_id) AS developer_name
          FROM public.sponsored_profiles sp
         WHERE sp.ends_at > NOW()
      ) p
    ), '[]'::JSONB),
    'briefs', COALESCE((
      SELECT JSONB_AGG(b ORDER BY b.ends_at DESC)
      FROM (
        SELECT sb.request_id, sb.started_at, sb.ends_at,
               r.project_type,
               LEFT(COALESCE(r.description, ''), 120) AS brief_excerpt
          FROM public.sponsored_briefs sb
          JOIN public.requests r ON r.id = sb.request_id
         WHERE sb.ends_at > NOW()
      ) b
    ), '[]'::JSONB),
    'prices', public.get_sponsoring_prices()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_subscriptions()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'active', COALESCE((
      SELECT JSONB_AGG(s ORDER BY s.ends_at DESC)
      FROM (
        SELECT sub.developer_id, sub.plan, sub.started_at, sub.ends_at,
               (SELECT COALESCE(dv.full_name, '—') FROM public.developers dv
                 WHERE dv.id = sub.developer_id) AS developer_name
          FROM public.subscriptions sub
         WHERE sub.ends_at > NOW()
      ) s
    ), '[]'::JSONB),
    'prices', public.get_pro_prices()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_feature_flags()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN COALESCE((
    SELECT JSONB_AGG(f ORDER BY f.key)
    FROM (
      SELECT ff.key, ff.enabled, ff.description, ff.updated_at
        FROM public.feature_flags ff
    ) f
  ), '[]'::JSONB);
END;
$$;

-- ------------------------------------------------------------
-- 7. admin_list_risk_events : incidents récents.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_risk_events(p_limit INTEGER DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = 'TLAAC';
  END IF;

  RETURN COALESCE((
    SELECT JSONB_AGG(e ORDER BY e.created_at DESC)
    FROM (
      SELECT re.id, re.user_id, re.event, re.severity, re.metadata, re.created_at
        FROM public.risk_events re
       ORDER BY re.created_at DESC
       LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
    ) e
  ), '[]'::JSONB);
END;
$$;

-- ------------------------------------------------------------
-- 8. Privilèges : jamais PUBLIC (rappel 0047), session admin.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_list_disputes(TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_disputes(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_support_tickets(TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_support_tickets(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_support_messages(UUID) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_support_messages(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_reply_support_ticket(UUID, TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_reply_support_ticket(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_close_support_ticket(UUID) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_close_support_ticket(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_agencies(TEXT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_agencies(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_sponsored() FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_sponsored() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_subscriptions() FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_feature_flags() FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_feature_flags() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_risk_events(INTEGER) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.admin_list_risk_events(INTEGER) TO authenticated;

COMMIT;