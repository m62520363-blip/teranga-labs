-- 0076_find_user_by_email.sql
-- Recherche ciblée d'un utilisateur par email (évite listUsers(perPage:1000)
-- qui charge 1000 utilisateurs et rate les suivants).
-- Accès : service_role uniquement.

CREATE OR REPLACE FUNCTION public.find_user_by_email(p_email TEXT)
RETURNS TABLE (id UUID, email TEXT, phone TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id, u.email, u.phone
  FROM auth.users u
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_user_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(TEXT) TO service_role;

-- Recherche ciblée d'un utilisateur par téléphone (E.164).
CREATE OR REPLACE FUNCTION public.find_user_by_phone(p_phone TEXT)
RETURNS TABLE (id UUID, email TEXT, phone TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id, u.email, u.phone
  FROM auth.users u
  WHERE u.phone = p_phone
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_user_by_phone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_by_phone(TEXT) TO service_role;