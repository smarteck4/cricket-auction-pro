REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_super(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_id(uuid) FROM anon;