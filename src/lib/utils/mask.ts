export function stripDigits(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function formatCnpj(digits: string | null | undefined): string | null {
  if (!digits) return null;
  const d = stripDigits(digits);
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function formatCep(digits: string | null | undefined): string | null {
  if (!digits) return null;
  const d = stripDigits(digits);
  if (d.length !== 8) return d;
  return `${d.slice(0, 5)}-${d.slice(5, 8)}`;
}

export function applyCnpjMask(raw: string): string {
  const d = stripDigits(raw).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function applyCepMask(raw: string): string {
  const d = stripDigits(raw).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
