import type { ClientChargeRow } from "@/lib/db/queries/client-charges";

export type ClientCashMonthSummary = {
  monthStart: string;
  monthEnd: string;
  toReceiveThisMonth: number;
  receivedThisMonth: number;
  overdueTotal: number;
};

function monthBoundsFromRef(refYmd: string): { start: string; end: string } {
  const ym = refYmd.slice(0, 7);
  const [y, m] = ym.split("-");
  const year = Number(y);
  const month = Number(m);
  const start = `${ym}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${ym}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function summarizeClientCash(
  charges: ClientChargeRow[],
  asOfDate: string = new Date().toISOString().slice(0, 10),
): ClientCashMonthSummary {
  const { start, end } = monthBoundsFromRef(asOfDate);
  let toReceiveThisMonth = 0;
  let receivedThisMonth = 0;
  let overdueTotal = 0;

  for (const c of charges) {
    if (
      c.paidAt &&
      c.paidAt >= start &&
      c.paidAt <= end &&
      (c.paidAmount ?? 0) > 0
    ) {
      receivedThisMonth += c.paidAmount ?? 0;
    }
    if (c.dueDate >= start && c.dueDate <= end && c.openAmount > 0) {
      toReceiveThisMonth += c.openAmount;
    }
    if (c.effectiveStatus === "atrasada" && c.openAmount > 0) {
      overdueTotal += c.openAmount;
    }
  }

  return {
    monthStart: start,
    monthEnd: end,
    toReceiveThisMonth,
    receivedThisMonth,
    overdueTotal,
  };
}
