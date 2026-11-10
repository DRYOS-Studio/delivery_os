/** Data calendário AAAA-MM-DD (sem fuso; como persiste no Postgres). */
export const CALENDAR_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE_RE.test(value)) return false;
  const [ys, ms, ds] = value.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= last;
}

/** Extrai AAAA-MM-DD de string calendário ou prefixo de timestamp ISO. */
export function calendarDateFromValue(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (isCalendarDate(trimmed)) return trimmed;
  if (trimmed.length >= 10) {
    const head = trimmed.slice(0, 10);
    if (isCalendarDate(head)) return head;
  }
  return null;
}

export function formatCalendarDateBR(ymd: string): string {
  if (!isCalendarDate(ymd)) return "—";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** Hoje no fuso local do runtime (para defaults de inputs `type="date"`). */
export function calendarDateLocalToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
