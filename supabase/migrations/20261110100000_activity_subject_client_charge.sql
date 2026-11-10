-- Enum activity_subject_type: valor client_charge (aplicar antes da tabela client_charges).

ALTER TYPE public.activity_subject_type ADD VALUE IF NOT EXISTS 'client_charge';

NOTIFY pgrst, 'reload schema';
