-- integration: enums para origem de incidente SLA (ntfy ingest + triagem).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sla_incident_source') THEN
    CREATE TYPE public.sla_incident_source AS ENUM ('manual', 'mcp', 'ntfy');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sla_problem_origin') THEN
    CREATE TYPE public.sla_problem_origin AS ENUM (
      'dryos',
      'client',
      'vendor',
      'unclassified'
    );
  END IF;
END $$;

COMMENT ON TYPE public.sla_incident_source IS
  'sla: canal de abertura do incidente (UI, MCP ou ingestão ntfy).';

COMMENT ON TYPE public.sla_problem_origin IS
  'sla: origem do problema. vendor não conta no SLA Dryos; unclassified = a classificar na triagem.';
