-- Referência opcional ao repositório Git (link HTTPS) em Cliente, Operação e Frente.
-- Sem integração Git; só URL para abrir no navegador.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS git_repository_url text;

ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS git_repository_url text;

ALTER TABLE public.frentes
  ADD COLUMN IF NOT EXISTS git_repository_url text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_clients_git_repository_url') THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT check_clients_git_repository_url
      CHECK (git_repository_url IS NULL OR length(trim(git_repository_url)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_operations_git_repository_url') THEN
    ALTER TABLE public.operations
      ADD CONSTRAINT check_operations_git_repository_url
      CHECK (git_repository_url IS NULL OR length(trim(git_repository_url)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_frentes_git_repository_url') THEN
    ALTER TABLE public.frentes
      ADD CONSTRAINT check_frentes_git_repository_url
      CHECK (git_repository_url IS NULL OR length(trim(git_repository_url)) > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.clients.git_repository_url IS
  'cliente: URL https do repositório Git principal do cliente (opcional). Link externo; sem credenciais embutidas.';

COMMENT ON COLUMN public.operations.git_repository_url IS
  'operação: URL https de repo específico desta Operação (opcional). Se vazio, a UI pode herdar do Cliente.';

COMMENT ON COLUMN public.frentes.git_repository_url IS
  'frente: URL https de repo específico desta Frente (opcional). Se vazio, a UI pode herdar da Operação ou do Cliente.';
