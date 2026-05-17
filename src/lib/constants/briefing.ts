export const BRIEFING_SECTIONS = [
  {
    key: "contexto",
    label: "Contexto",
    helper: "Quem é o cliente, qual a situação atual.",
  },
  {
    key: "objetivos",
    label: "Objetivos",
    helper: "O que esta Operação precisa entregar.",
  },
  {
    key: "escopo_incluido",
    label: "Escopo incluído",
    helper: "O que está dentro do contrato.",
  },
  {
    key: "escopo_excluido",
    label: "Escopo excluído",
    helper: "O que está fora, e por quê.",
  },
  {
    key: "premissas",
    label: "Premissas",
    helper: "O que assumimos verdadeiro (acessos, recursos, prazos).",
  },
  {
    key: "riscos",
    label: "Riscos",
    helper: "Visíveis no início; revisitados ao longo da Operação.",
  },
  {
    key: "stakeholders",
    label: "Stakeholders",
    helper: "Quem decide o quê do lado cliente (nome, papel, contato).",
  },
  {
    key: "observacoes",
    label: "Observações",
    helper: "Livre.",
  },
] as const;

export type BriefingSectionKey = (typeof BRIEFING_SECTIONS)[number]["key"];
