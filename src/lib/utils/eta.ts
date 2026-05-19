const WEEKDAY_LABELS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diffInDays(target: Date, now: Date): number {
  const a = startOfDay(target).getTime();
  const b = startOfDay(now).getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

export function formatEtaLabel(
  targetDate: string,
  now: Date = new Date(),
): string {
  const target = new Date(
    targetDate.length === 10 ? `${targetDate}T00:00:00` : targetDate,
  );
  if (Number.isNaN(target.getTime())) return "—";

  const days = diffInDays(target, now);
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days > 1 && days < 7) return WEEKDAY_LABELS_SHORT[target.getDay()] ?? "—";

  const dd = String(target.getDate()).padStart(2, "0");
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}
