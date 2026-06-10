// Tipo puro de área pra UI (client-safe, sem import de servidor).
// As áreas agora são dinâmicas (tabela `areas`) — carregadas via
// @/lib/db/queries/areas (listAreas). Não há mais enum/lista fixa.

export type AreaOption = { id: string; name: string };
