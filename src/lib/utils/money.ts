const BR = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoneyBR(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return BR.format(value);
}

export function parseMoneyBR(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const cleaned = trimmed
    .replace(/R\$\s*/i, "")
    .replace(/\s/g, "");
  // Decide separator: if has both '.' and ',', '.' is thousand and ',' is decimal (BR).
  // If only ',', it's decimal.
  // If only '.', could be thousand (1.234) or decimal (1.5) — heuristic: '.' with exactly 2 digits after = decimal.
  let normalized: string;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/\.\d{1,2}$/.test(cleaned) && !/\d{1,3}\.\d{3}/.test(cleaned)) {
    normalized = cleaned;
  } else {
    normalized = cleaned.replace(/\./g, "");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
