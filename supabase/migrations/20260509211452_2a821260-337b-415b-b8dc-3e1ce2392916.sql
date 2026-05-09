GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_id(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_owner_id(uuid) TO anon;