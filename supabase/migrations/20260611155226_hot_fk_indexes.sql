-- Índices nos 5 FKs quentes (issue #131, audit AUDIT-2026-06-11 achado #13).
-- Postgres não auto-indexa FK; todas estas colunas são filtradas em queries
-- reais (joins frente→operation, allocations por frente/pessoa, listagens por
-- cliente). Os demais FKs do advisor (created_by etc.) são frios — índice não
-- usado é custo de write, ficam de fora deliberadamente.

CREATE INDEX IF NOT EXISTS idx_frentes_operation_id  ON public.frentes (operation_id);
CREATE INDEX IF NOT EXISTS idx_allocations_frente_id ON public.allocations (frente_id);
CREATE INDEX IF NOT EXISTS idx_allocations_person_id ON public.allocations (person_id);
CREATE INDEX IF NOT EXISTS idx_operations_client_id  ON public.operations (client_id);
CREATE INDEX IF NOT EXISTS idx_persons_client_id     ON public.persons (client_id);
