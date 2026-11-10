export type ClientHubTabKey =
  | "visao"
  | "dados"
  | "contratos"
  | "cobrancas"
  | "cac"
  | "cofre"
  | "operacoes"
  | "pessoas"
  | "ferramentas"
  | "diagnostico"
  | "tarefas";

export type ClientHubTabDef = {
  key: ClientHubTabKey;
  label: string;
  href: (clientId: string) => string;
  adminOnly?: boolean;
};

export const CLIENT_HUB_TABS: readonly ClientHubTabDef[] = [
  { key: "visao", label: "Visão", href: (id) => `/clients/${id}` },
  { key: "dados", label: "Dados", href: (id) => `/clients/${id}/dados` },
  {
    key: "contratos",
    label: "Contratos",
    href: (id) => `/clients/${id}/contratos`,
    adminOnly: true,
  },
  {
    key: "cobrancas",
    label: "Cobranças",
    href: (id) => `/clients/${id}/cobrancas`,
    adminOnly: true,
  },
  {
    key: "cac",
    label: "CAC",
    href: (id) => `/clients/${id}/cac`,
    adminOnly: true,
  },
  {
    key: "cofre",
    label: "Cofre",
    href: (id) => `/clients/${id}/cofre`,
  },
  { key: "operacoes", label: "Operações", href: (id) => `/clients/${id}/operacoes` },
  { key: "pessoas", label: "Pessoas", href: (id) => `/clients/${id}/pessoas` },
  {
    key: "ferramentas",
    label: "Ferramentas",
    href: (id) => `/clients/${id}/ferramentas`,
  },
  { key: "diagnostico", label: "Diagnóstico", href: (id) => `/clients/${id}/diagnostico` },
  { key: "tarefas", label: "Tarefas", href: (id) => `/clients/${id}/tarefas` },
] as const;

const LEGACY_TAB_QUERY: Record<string, ClientHubTabKey> = {
  visao: "visao",
  dados: "dados",
  contratos: "contratos",
  cobrancas: "cobrancas",
  cac: "cac",
  cofre: "cofre",
  operacoes: "operacoes",
  pessoas: "pessoas",
  ferramentas: "ferramentas",
  diagnostico: "diagnostico",
  tarefas: "tarefas",
};

export function clientHubPathFromLegacyTab(
  clientId: string,
  tab: string | undefined,
): string | null {
  if (!tab) return null;
  const key = LEGACY_TAB_QUERY[tab];
  if (!key) return null;
  const def = CLIENT_HUB_TABS.find((t) => t.key === key);
  return def ? def.href(clientId) : null;
}
