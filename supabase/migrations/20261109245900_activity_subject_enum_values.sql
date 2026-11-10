-- Enum labels usados em can_read_activity_subject / activity_events.
-- Deve rodar em transação própria ANTES de recriar funções que referenciam os valores.
-- Produção: aplicar este arquivo (ou os ADD VALUE sozinhos) antes da migration de custos.

ALTER TYPE public.activity_subject_type ADD VALUE IF NOT EXISTS 'profile';
ALTER TYPE public.activity_subject_type ADD VALUE IF NOT EXISTS 'operation_cost';
