"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoneyBR } from "@/lib/utils/money";

export type BarDatum = {
  label: string;
  value: number;
};

export type BarValueFormat = "currency" | "count_operations" | "raw";

type Props = {
  data: BarDatum[];
  format?: BarValueFormat;
  height?: number;
  color?: string;
  emptyLabel?: string;
};

function truncate(s: string, n = 20): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function formatValue(v: number, format: BarValueFormat): string {
  if (format === "currency") return formatMoneyBR(v);
  if (format === "count_operations")
    return `${v} ${v === 1 ? "operação" : "operações"}`;
  return String(v);
}

function TooltipContent({
  active,
  payload,
  format,
}: {
  active?: boolean;
  payload?: Array<{ payload: BarDatum; value: number }>;
  format: BarValueFormat;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0];
  if (!datum) return null;
  return (
    <div className="bg-surface border border-line rounded-sm px-3 py-2 shadow-sm">
      <p className="font-mono text-[10px] uppercase tracking-wide text-mute">
        {datum.payload.label}
      </p>
      <p className="font-display text-sm font-semibold text-ink mt-0.5">
        {formatValue(datum.value, format)}
      </p>
    </div>
  );
}

export function HorizontalBarChart({
  data,
  format = "raw",
  height = 240,
  color = "#5C8866",
  emptyLabel = "Sem dados",
}: Props) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-mute text-sm border border-dashed border-line rounded-sm"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, label: d.label }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
      >
        <YAxis
          dataKey="label"
          type="category"
          width={140}
          tick={{ fontSize: 12, fill: "var(--color-mute)" }}
          tickFormatter={(v) => truncate(String(v), 20)}
          axisLine={false}
          tickLine={false}
        />
        <XAxis type="number" hide />
        <Tooltip
          cursor={{ fill: "var(--color-surface-deep, #00000008)" }}
          content={<TooltipContent format={format} />}
        />
        <Bar dataKey="value" fill={color} radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
