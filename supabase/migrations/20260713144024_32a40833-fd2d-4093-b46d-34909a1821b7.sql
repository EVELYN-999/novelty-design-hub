
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

REVOKE EXECUTE ON FUNCTION public.terminate_election_tickets(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.terminate_election_tickets(uuid) TO service_role;
