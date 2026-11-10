-- activity_events: assunto sla_incident (deve rodar antes de funções/triggers que referenciam o valor).

ALTER TYPE public.activity_subject_type ADD VALUE IF NOT EXISTS 'sla_incident';
