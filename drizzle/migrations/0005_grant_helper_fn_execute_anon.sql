-- Anonymous (logged-out) requests evaluate policies whose roles include `public`,
-- and those policies call these SECURITY DEFINER helpers. Without EXECUTE for
-- anon, every public read on the affected tables fails with
-- "permission denied for function is_admin_or_super" (HTTP 401).
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;