-- PostgREST: expõe can_access_client_vault após 20261110500000 (evita PGRST202 no preflight).
-- Rafael: se a UI/MCP ainda falhar só no rpc(), rode este arquivo ou o NOTIFY abaixo.

GRANT EXECUTE ON FUNCTION public.can_access_client_vault(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
