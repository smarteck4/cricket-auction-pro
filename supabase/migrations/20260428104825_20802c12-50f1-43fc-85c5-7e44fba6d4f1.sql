-- Restrict execution of SECURITY DEFINER functions to authenticated users only.
-- The functions still enforce role-based authorization internally.

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.place_bid_atomic(uuid, uuid, uuid, integer)',
    'public.close_bid_atomic(uuid)',
    'public.re_auction_player(uuid)',
    'public.update_user_role(uuid, public.app_role)',
    'public.has_role(uuid, public.app_role)',
    'public.is_admin_or_super(uuid)',
    'public.get_owner_id(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

-- RLS policies reference has_role / is_admin_or_super / get_owner_id.
-- The Postgres planner runs those as the table's caller, so we also need
-- to allow the authenticator role to evaluate them during RLS checks.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticator;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO authenticator;
GRANT EXECUTE ON FUNCTION public.get_owner_id(uuid) TO authenticator;

-- Trigger functions should never be callable directly by API clients.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_player_career_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_tournament_points_on_match_complete() FROM PUBLIC, anon, authenticated;