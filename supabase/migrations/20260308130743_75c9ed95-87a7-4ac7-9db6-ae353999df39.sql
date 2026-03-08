
-- Super admins can manage all roles
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admins can view all profiles for user management
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Function for super_admin to update user roles safely
CREATE OR REPLACE FUNCTION public.update_user_role(p_user_id uuid, p_new_role app_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN jsonb_build_object('error', 'Unauthorized: Super Admin access required');
  END IF;

  IF p_user_id = auth.uid() THEN
    RETURN jsonb_build_object('error', 'Cannot change your own role');
  END IF;

  IF p_new_role = 'super_admin' THEN
    RETURN jsonb_build_object('error', 'Cannot assign super_admin role through UI');
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_new_role)
  ON CONFLICT (user_id, role) DO UPDATE SET role = p_new_role;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND role != p_new_role;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'new_role', p_new_role);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_user_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_role(uuid, app_role) TO authenticated;
