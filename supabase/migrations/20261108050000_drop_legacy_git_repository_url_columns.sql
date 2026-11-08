-- Fase 2 (pós-deploy do app que lê `repository_links`): remove colunas singulares legadas.
-- NÃO aplicar antes do merge/deploy do PR que remove leitura/escrita em git_repository_url.
-- A fase 1 (`20261108040000`) já copiou dados para repository_links; colunas legadas são redundantes.

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS check_clients_git_repository_url;
ALTER TABLE public.operations DROP CONSTRAINT IF EXISTS check_operations_git_repository_url;
ALTER TABLE public.frentes DROP CONSTRAINT IF EXISTS check_frentes_git_repository_url;

ALTER TABLE public.clients DROP COLUMN IF EXISTS git_repository_url;
ALTER TABLE public.operations DROP COLUMN IF EXISTS git_repository_url;
ALTER TABLE public.frentes DROP COLUMN IF EXISTS git_repository_url;
