const MONTH_LABELS_LONG = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MONTH_LABELS_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export type Period = {
  yyyymm: string;
  year: number;
  month: number;
  monthLabel: string;
  monthLabelShort: string;
  prevYyyymm: string;
  prevMonthLabel: string;
};

function buildPeriod(year: number, month: number): Period {
  const yyyymm = `${year}-${String(month).padStart(2, "0")}`;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevYyyymm = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  return {
    yyyymm,
    year,
    month,
    monthLabel: MONTH_LABELS_LONG[month - 1] ?? "",
    monthLabelShort: MONTH_LABELS_SHORT[month - 1] ?? "",
    prevYyyymm,
    prevMonthLabel: MONTH_LABELS_LONG[prevMonth - 1] ?? "",
  };
}

export function getCurrentPeriod(now: Date = new Date()): Period {
  return buildPeriod(now.getFullYear(), now.getMonth() + 1);
}

export function periodFromString(yyyymm: string): Period | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(yyyymm);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return buildPeriod(year, month);
}

export function operationMonthIndex(
  startDate: string | null,
  createdAt: string,
  now: Date = new Date(),
): number {
  const baseStr = startDate ?? createdAt.slice(0, 10);
  const base = new Date(`${baseStr}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return 1;
  const months =
    (now.getUTCFullYear() - base.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - base.getUTCMonth()) +
    1;
  return Math.max(1, months);
}
