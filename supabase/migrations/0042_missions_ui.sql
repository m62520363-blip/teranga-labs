-- ============================================================
-- 0042_missions_ui.sql
-- M4 — UI missions (§22) : lecture consolidée pour les deux
-- parties (développeur / client). Le SELECT direct sur requests
-- est restreint (RLS : seuls les briefs « ouverts » sont
-- lisibles) : cette RPC SECURITY DEFINER ne renvoie que des
-- champs publics (jamais le WhatsApp) + partie adverse + journal.
-- NON destructif.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.list_my_missions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous.' USING ERRCODE = 'TLNAU';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'request_id', m.request_id,
        'conversation_id', m.conversation_id,
        'offer_id', m.offer_id,
        'status', m.status,
        'agreed_price_fcfa', m.agreed_price_fcfa,
        'agreed_days', m.agreed_days,
        'description', m.description,
        'started_at', m.started_at,
        'completed_at', m.completed_at,
        'created_at', m.created_at,
        'updated_at', m.updated_at,
        'opponent', CASE
          WHEN m.client_id = v_user THEN jsonb_build_object(
            'related_as', 'developer',
            'full_name', COALESCE(NULLIF(trim(d.full_name), ''), d.username, m.developer_id::text),
            'username', d.username,
            'city', d.city,
            'avatar_url', d.avatar_url
          )
          ELSE jsonb_build_object(
            'related_as', 'client',
            'company_name', cp.company_name,
            'contact_name', cp.contact_name,
            'city', cp.city
          )
        END,
        'request', jsonb_build_object(
          'project_type', r.project_type,
          'budget', r.budget,
          'client_city', r.client_city
        ),
        'events', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', e.id,
            'actor_id', e.actor_id,
            'status_from', e.status_from,
            'status_to', e.status_to,
            'comment', e.comment,
            'created_at', e.created_at
          ) ORDER BY e.created_at ASC)
          FROM public.mission_events e
          WHERE e.mission_id = m.id
        ), '[]'::jsonb)
      ) ORDER BY m.created_at DESC
    )
    FROM public.missions m
    LEFT JOIN public.developers d ON d.id = m.developer_id
    LEFT JOIN public.client_profiles cp ON cp.id = m.client_id
    LEFT JOIN public.requests r ON r.id = m.request_id
    WHERE m.developer_id = v_user OR m.client_id = v_user
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_missions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_missions() TO authenticated;

COMMIT;