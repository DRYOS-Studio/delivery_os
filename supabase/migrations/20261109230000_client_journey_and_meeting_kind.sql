-- Jornada do cliente + tipo de reunião (onboarding).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_journey_status') THEN
    CREATE TYPE public.client_journey_status AS ENUM (
      'em_cadastro',
      'onboarding_pendente',
      'onboarding_agendado',
      'em_implantacao',
      'ativo',
      'pausado',
      'encerrado'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_kind') THEN
    CREATE TYPE public.meeting_kind AS ENUM ('general', 'onboarding');
  END IF;
END $$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS journey_status public.client_journey_status
    NOT NULL DEFAULT 'onboarding_pendente';

COMMENT ON COLUMN public.clients.journey_status IS
  'Jornada comercial do cliente (distinto de client_contracts.status).';

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS kind public.meeting_kind NOT NULL DEFAULT 'general';

COMMENT ON COLUMN public.meetings.kind IS
  'Classificação da reunião; onboarding dispara transições na jornada do cliente.';

CREATE INDEX IF NOT EXISTS idx_clients_journey_status
  ON public.clients (journey_status)
  WHERE archived_at IS NULL;

-- ---------------------------------------------------------------------------
-- Activity: journey_status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_log_activity_clients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'client', NEW.id, NULL, NEW.id,
      'created', NULL, NULL,
      jsonb_build_object('name', NEW.name, 'slug', NEW.slug),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'name', to_jsonb(OLD.name), to_jsonb(NEW.name), '{}'::jsonb
      );
    END IF;
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'slug', to_jsonb(OLD.slug), to_jsonb(NEW.slug), '{}'::jsonb
      );
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'notes', to_jsonb(OLD.notes), to_jsonb(NEW.notes), '{}'::jsonb
      );
    END IF;
    IF NEW.legal_name IS DISTINCT FROM OLD.legal_name THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'legal_name', to_jsonb(OLD.legal_name), to_jsonb(NEW.legal_name), '{}'::jsonb
      );
    END IF;
    IF NEW.cnpj IS DISTINCT FROM OLD.cnpj THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'cnpj', to_jsonb(OLD.cnpj), to_jsonb(NEW.cnpj), '{}'::jsonb
      );
    END IF;
    IF NEW.primary_contact_name IS DISTINCT FROM OLD.primary_contact_name THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'primary_contact_name', to_jsonb(OLD.primary_contact_name), to_jsonb(NEW.primary_contact_name), '{}'::jsonb
      );
    END IF;
    IF NEW.primary_contact_email IS DISTINCT FROM OLD.primary_contact_email THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'primary_contact_email', to_jsonb(OLD.primary_contact_email), to_jsonb(NEW.primary_contact_email), '{}'::jsonb
      );
    END IF;
    IF NEW.journey_status IS DISTINCT FROM OLD.journey_status THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'journey_status', to_jsonb(OLD.journey_status::text), to_jsonb(NEW.journey_status::text), '{}'::jsonb
      );
    END IF;
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'archived_at', to_jsonb(OLD.archived_at), to_jsonb(NEW.archived_at), '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

-- Contrato vigente → onboarding_pendente (sem regredir ativo/pausado/encerrado/em_implantacao).
CREATE OR REPLACE FUNCTION public.trg_client_journey_on_contract_vigente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'vigente'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.clients c
    SET journey_status = 'onboarding_pendente'
    WHERE c.id = NEW.client_id
      AND c.archived_at IS NULL
      AND c.journey_status IN (
        'em_cadastro',
        'onboarding_pendente',
        'onboarding_agendado'
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_journey_contract_vigente ON public.client_contracts;
CREATE TRIGGER trg_client_journey_contract_vigente
  AFTER INSERT OR UPDATE OF status ON public.client_contracts
  FOR EACH ROW EXECUTE FUNCTION public.trg_client_journey_on_contract_vigente();

-- Reunião onboarding → jornada automática.
CREATE OR REPLACE FUNCTION public.trg_client_journey_on_meeting_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF NEW.kind <> 'onboarding' THEN
    RETURN NEW;
  END IF;

  SELECT o.client_id INTO v_client_id
  FROM public.operations o
  WHERE o.id = NEW.operation_id;

  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.ended_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.ended_at IS DISTINCT FROM NEW.ended_at) THEN
    UPDATE public.clients c
    SET journey_status = 'em_implantacao'
    WHERE c.id = v_client_id
      AND c.archived_at IS NULL
      AND c.journey_status IN ('onboarding_pendente', 'onboarding_agendado');
  ELSIF NEW.scheduled_at IS NOT NULL
        AND (TG_OP = 'INSERT' OR OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at) THEN
    UPDATE public.clients c
    SET journey_status = 'onboarding_agendado'
    WHERE c.id = v_client_id
      AND c.archived_at IS NULL
      AND c.journey_status = 'onboarding_pendente';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_journey_meeting_onboarding ON public.meetings;
CREATE TRIGGER trg_client_journey_meeting_onboarding
  AFTER INSERT OR UPDATE OF scheduled_at, ended_at, kind ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.trg_client_journey_on_meeting_onboarding();

-- ---------------------------------------------------------------------------
-- Backfill jornada (clientes existentes)
-- Precedência (Rafael, PR #194):
--   1 encerrado | 2 ativo (op ativa, com ou sem contrato)
--   3 em_implantacao / onboarding_agendado (sem op ativa, por reunião onboarding)
--   4 contrato vigente sem op ativa → onboarding_pendente | 5 demais → onboarding_pendente (default)
-- ---------------------------------------------------------------------------
UPDATE public.clients
SET journey_status = 'encerrado'
WHERE archived_at IS NOT NULL;

-- 2) Operação ativa → ativo (contrato vigente não é requisito).
UPDATE public.clients c
SET journey_status = 'ativo'
WHERE c.archived_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.operations o
    WHERE o.client_id = c.id
      AND o.archived_at IS NULL
      AND o.status IN ('em_construcao', 'em_operacao', 'janela_critica')
  );

-- 3a) Sem operação ativa + onboarding realizada.
UPDATE public.clients c
SET journey_status = 'em_implantacao'
WHERE c.archived_at IS NULL
  AND c.journey_status = 'onboarding_pendente'
  AND NOT EXISTS (
    SELECT 1
    FROM public.operations o
    WHERE o.client_id = c.id
      AND o.archived_at IS NULL
      AND o.status IN ('em_construcao', 'em_operacao', 'janela_critica')
  )
  AND EXISTS (
    SELECT 1
    FROM public.meetings m
    JOIN public.operations o ON o.id = m.operation_id
    WHERE o.client_id = c.id
      AND m.kind = 'onboarding'
      AND m.ended_at IS NOT NULL
  );

-- 3b) Sem operação ativa + onboarding agendada (sem término).
UPDATE public.clients c
SET journey_status = 'onboarding_agendado'
WHERE c.archived_at IS NULL
  AND c.journey_status = 'onboarding_pendente'
  AND NOT EXISTS (
    SELECT 1
    FROM public.operations o
    WHERE o.client_id = c.id
      AND o.archived_at IS NULL
      AND o.status IN ('em_construcao', 'em_operacao', 'janela_critica')
  )
  AND EXISTS (
    SELECT 1
    FROM public.meetings m
    JOIN public.operations o ON o.id = m.operation_id
    WHERE o.client_id = c.id
      AND m.kind = 'onboarding'
      AND m.scheduled_at IS NOT NULL
      AND m.ended_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.meetings m
    JOIN public.operations o ON o.id = m.operation_id
    WHERE o.client_id = c.id
      AND m.kind = 'onboarding'
      AND m.ended_at IS NOT NULL
  );

-- 4–5) Contrato vigente sem op ativa e demais não ativos permanecem onboarding_pendente (DEFAULT da coluna).

NOTIFY pgrst, 'reload schema';
