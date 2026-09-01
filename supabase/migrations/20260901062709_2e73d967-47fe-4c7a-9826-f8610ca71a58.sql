REVOKE EXECUTE ON FUNCTION public.has_workspace_access(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_workspace_access(uuid, uuid) TO service_role;