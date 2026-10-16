export type DiagnosticModelMeta = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  description: string;
  totalDimensions: number;
  totalQuestions: number;
};

export const DEFAULT_DIAGNOSTIC_MODEL: DiagnosticModelMeta = {
  id: "estruturacao_processos",
  title: "Diagnóstico de Gestão",
  subtitle: "Estruturação de Processos",
  category: "Ops & Finance",
  description:
    "Avaliação de maturidade de gestão em 13 dimensões com 61 perguntas, alertas críticos e plano de ação em 3 horizontes.",
  totalDimensions: 13,
  totalQuestions: 61,
};

export const DIAGNOSTIC_MODELS: Record<string, DiagnosticModelMeta> = {
  estruturacao_processos: DEFAULT_DIAGNOSTIC_MODEL,
};

export function getDiagnosticModel(type = "estruturacao_processos"): DiagnosticModelMeta {
  return DIAGNOSTIC_MODELS[type] ?? DEFAULT_DIAGNOSTIC_MODEL;
}
