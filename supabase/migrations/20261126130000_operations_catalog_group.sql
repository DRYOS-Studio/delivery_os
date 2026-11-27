-- operacao: linha de produto passa a ser catalog_group (grupo comercial do catálogo).
-- product_line (core/spark/studio) permanece legível, sem backfill nesta migration.
-- Depende de 20261126125900_catalog_offer_group_add_revenue.sql (enum 'revenue').

ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS catalog_group public.catalog_offer_group;

ALTER TABLE public.operations
  ALTER COLUMN product_line DROP NOT NULL;

COMMENT ON COLUMN public.operations.catalog_group IS
  'operacao: grupo comercial do catálogo (linha de produto). Preferir este campo; product_line é legado.';

COMMENT ON COLUMN public.operations.product_line IS
  'operacao: legado core/spark/studio — deprecado; novas Operações usam catalog_group.';

CREATE OR REPLACE FUNCTION public.trg_log_activity_operations()
RETURNS trigger
LANGUAGE plplpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'operation', NEW.id, NEW.id, NEW.client_id,
      'created', NULL, NULL,
      jsonb_build_object('name', NEW.name, 'status', NEW.status::text, 'client_id', NEW.client_id),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'name', to_jsonb(OLD.name), to_jsonb(NEW.name), '{}'::jsonb
      );
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'status', to_jsonb(OLD.status), to_jsonb(NEW.status), '{}'::jsonb
      );
    END IF;
    IF NEW.catalog_group IS DISTINCT FROM OLD.catalog_group THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'catalog_group', to_jsonb(OLD.catalog_group), to_jsonb(NEW.catalog_group), '{}'::jsonb
      );
    END IF;
    IF NEW.product_line IS DISTINCT FROM OLD.product_line THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'product_line', to_jsonb(OLD.product_line), to_jsonb(NEW.product_line), '{}'::jsonb
      );
    END IF;
    IF NEW.response_hours IS DISTINCT FROM OLD.response_hours THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'response_hours', to_jsonb(OLD.response_hours), to_jsonb(NEW.response_hours), '{}'::jsonb
      );
    END IF;
    IF NEW.resolution_hours IS DISTINCT FROM OLD.resolution_hours THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'resolution_hours', to_jsonb(OLD.resolution_hours), to_jsonb(NEW.resolution_hours), '{}'::jsonb
      );
    END IF;
    IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'start_date', to_jsonb(OLD.start_date), to_jsonb(NEW.start_date), '{}'::jsonb
      );
    END IF;
    IF NEW.end_date IS DISTINCT FROM OLD.end_date THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'end_date', to_jsonb(OLD.end_date), to_jsonb(NEW.end_date), '{}'::jsonb
      );
    END IF;
    IF NEW.diagnostic_id IS DISTINCT FROM OLD.diagnostic_id THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'diagnostic_id', to_jsonb(OLD.diagnostic_id), to_jsonb(NEW.diagnostic_id), '{}'::jsonb
      );
    END IF;
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'archived_at', to_jsonb(OLD.archived_at), to_jsonb(NEW.archived_at), '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;