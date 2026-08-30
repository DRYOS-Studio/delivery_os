-- operation-lifecycle-archive (issue #159) — parte 1 de 2.
-- Separada da migration das funcoes por conservadorismo: literal de enum novo em statement
-- SQL direto nao pode ser usado na transacao que o adiciona. Corpo de plpgsql e' late-bound
-- e provavelmente nao precisaria, mas o custo de separar e' zero.

ALTER TYPE public.operation_status ADD VALUE IF NOT EXISTS 'concluida';
ALTER TYPE public.operation_status ADD VALUE IF NOT EXISTS 'cancelada';

COMMENT ON COLUMN public.operations.status IS
  'ciclo de vida do contrato. Ativos: em_construcao, em_operacao, janela_critica. Terminais: '
  'concluida, cancelada (e arquivada, legado — nunca alvo de escrita nova). Terminal e '
  'archived_at sao eixos distintos: terminal sai dos agregados, archived_at tira da vista.';
