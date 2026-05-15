-- DRYOS Delivery — initial schema (semana 1)
-- Cria 5 entidades base: clients, operations, frentes, persons, allocations.
-- Inclui enums, FKs nomeadas, CHECKs dos invariantes do CLAUDE.md, triggers updated_at,
-- COMMENTs, RLS habilitado e policies básicas (autenticado tem acesso total na sem 1;
-- granularidade Admin/Membro entra com `profiles` na sem 2).
--
-- Idempotente: roda múltiplas vezes sem erro.

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.product_line AS ENUM ('core', 'spark', 'studio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.frente_cycle_type AS ENUM ('a', 'b', 'c', 'd', 'e');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.frente_domain AS ENUM ('infra', 'dados_analiticos', 'dados_tecnicos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.operation_status AS ENUM ('em_construcao', 'em_operacao', 'janela_critica', 'arquivada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.frente_phase AS ENUM ('descoberta', 'execucao', 'entrega', 'encerrada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.person_kind AS ENUM ('internal', 'external');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.allocation_role AS ENUM ('responsavel', 'executor', 'aprovador', 'plantao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.recurrence AS ENUM ('mensal', 'trimestral', 'anual', 'unica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TRIGGER FUNCTION: set_updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- TABLE: clients
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

COMMENT ON TABLE public.clients IS
  'cliente: empresa atendida pela DRYOS. Origem de Operacoes, Pessoas externas, Credenciais.';

DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- TABLE: persons
-- (Criada antes de operations porque operations não depende de persons,
--  e frentes depende de persons via responsible_person_id.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.persons (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          public.person_kind NOT NULL,
  name          text NOT NULL,
  email         text,
  specialty     text,
  external_role text,
  client_id     uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  archived_at   timestamptz,
  CONSTRAINT fk_persons_client_id FOREIGN KEY (client_id)
    REFERENCES public.clients(id) ON DELETE RESTRICT,
  CONSTRAINT chk_persons_kind_consistency CHECK (
    (kind = 'internal' AND specialty IS NOT NULL AND external_role IS NULL AND client_id IS NULL)
    OR
    (kind = 'external' AND specialty IS NULL AND external_role IS NOT NULL AND client_id IS NOT NULL)
  )
);

COMMENT ON TABLE public.persons IS
  'pessoa: interna (DRYOS, com specialty) ou externa (do Cliente, com external_role + client_id). Campos mutuamente exclusivos via CHECK.';

COMMENT ON COLUMN public.persons.kind IS
  'discrimina internal vs external. Determina quais colunas devem estar preenchidas (ver CHECK chk_persons_kind_consistency).';

DROP TRIGGER IF EXISTS trg_persons_updated_at ON public.persons;
CREATE TRIGGER trg_persons_updated_at
  BEFORE UPDATE ON public.persons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- TABLE: operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.operations (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                  uuid NOT NULL,
  product_line               public.product_line NOT NULL,
  name                       text NOT NULL,
  status                     public.operation_status NOT NULL DEFAULT 'em_construcao',
  monthly_recurring_revenue  numeric(14, 2),
  recurrence                 public.recurrence,
  start_date                 date,
  end_date                   date,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  archived_at                timestamptz,
  CONSTRAINT fk_operations_client_id FOREIGN KEY (client_id)
    REFERENCES public.clients(id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.operations IS
  'operacao: contrato comercial (Core/Spark/Studio) vendido a um Cliente. Carrega preco, recorrencia, status macro. Tipo C/E nao tem end_date (validacao via Frente, fora do escopo desta migracao).';

COMMENT ON COLUMN public.operations.end_date IS
  'nullable: Operacoes com Frentes de ciclo C/E (continuo) nao tem fim. Validacao cross-table fica no app/trigger futuro.';

DROP TRIGGER IF EXISTS trg_operations_updated_at ON public.operations;
CREATE TRIGGER trg_operations_updated_at
  BEFORE UPDATE ON public.operations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- TABLE: frentes
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.frentes (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id             uuid NOT NULL,
  name                     text NOT NULL,
  cycle_type               public.frente_cycle_type NOT NULL,
  domain                   public.frente_domain NOT NULL,
  phase                    public.frente_phase NOT NULL DEFAULT 'descoberta',
  actionable_status        text NOT NULL,
  actionable_status_since  timestamptz NOT NULL DEFAULT now(),
  responsible_person_id    uuid,
  start_date               date,
  end_date                 date,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  archived_at              timestamptz,
  CONSTRAINT fk_frentes_operation_id FOREIGN KEY (operation_id)
    REFERENCES public.operations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_frentes_responsible_person_id FOREIGN KEY (responsible_person_id)
    REFERENCES public.persons(id) ON DELETE SET NULL,
  CONSTRAINT chk_frentes_actionable_status_min_length
    CHECK (char_length(actionable_status) >= 15),
  CONSTRAINT chk_frentes_actionable_status_not_generic
    CHECK (
      lower(trim(actionable_status)) NOT IN
      ('em andamento', 'em revisão', 'pendente', 'a fazer', 'em progresso')
    )
);

COMMENT ON TABLE public.frentes IS
  'frente: fluxo de entrega dentro de uma Operacao. Tem ciclo (A-E), dominio e status acionavel validado no banco.';

COMMENT ON COLUMN public.frentes.actionable_status IS
  'status acionavel obrigatorio (principio 04 + Invariante 4). Format "aguardando X de Y desde Z". CHECK forca comprimento >= 15 e rejeita lista de genericos.';

COMMENT ON COLUMN public.frentes.actionable_status_since IS
  'timestamp de quando o status acionavel atual foi definido. Usado na UI: "aguardando X de Y desde Z".';

DROP TRIGGER IF EXISTS trg_frentes_updated_at ON public.frentes;
CREATE TRIGGER trg_frentes_updated_at
  BEFORE UPDATE ON public.frentes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- TABLE: allocations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.allocations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id            uuid NOT NULL,
  frente_id            uuid NOT NULL,
  role                 public.allocation_role NOT NULL,
  capacity_weekly_pct  numeric(5, 2) NOT NULL DEFAULT 0,
  start_date           date NOT NULL DEFAULT current_date,
  end_date             date,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_allocations_person_id FOREIGN KEY (person_id)
    REFERENCES public.persons(id) ON DELETE CASCADE,
  CONSTRAINT fk_allocations_frente_id FOREIGN KEY (frente_id)
    REFERENCES public.frentes(id) ON DELETE CASCADE,
  CONSTRAINT chk_allocations_capacity_range
    CHECK (capacity_weekly_pct >= 0 AND capacity_weekly_pct <= 100)
);

COMMENT ON TABLE public.allocations IS
  'alocacao: relacao Pessoa <-> Frente com papel, capacidade semanal (0-100%) e periodo. Soma por pessoa pode exceder 100 (sobrecarga visivel, nao bloqueada).';

COMMENT ON COLUMN public.allocations.capacity_weekly_pct IS
  'percentual da semana comprometido nesta Frente (Invariante 11). CHECK 0..100 por linha; soma por pessoa pode passar (sobrecarga visivel).';

DROP TRIGGER IF EXISTS trg_allocations_updated_at ON public.allocations;
CREATE TRIGGER trg_allocations_updated_at
  BEFORE UPDATE ON public.allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- RLS — Row Level Security
-- ============================================================================

ALTER TABLE public.clients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frentes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

-- Semana 1: autenticado tem acesso total. Granularidade Admin/Membro/Visualizador
-- entra na sem 2 com a tabela `profiles` (registrado em STATE.md AD-002).

DROP POLICY IF EXISTS authenticated_full_access ON public.clients;
CREATE POLICY authenticated_full_access ON public.clients
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_full_access ON public.operations;
CREATE POLICY authenticated_full_access ON public.operations
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_full_access ON public.frentes;
CREATE POLICY authenticated_full_access ON public.frentes
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_full_access ON public.persons;
CREATE POLICY authenticated_full_access ON public.persons
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_full_access ON public.allocations;
CREATE POLICY authenticated_full_access ON public.allocations
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
