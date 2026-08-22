"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

type Props = {
  data: number[];
  color?: string;
  height?: number;
};

export function Sparkline({
  data,
  color = "var(--color-sage-deep)",
  height = 40,
}: Props): React.JSX.Element {
  const chartData = data.map((value, i) => ({ i, value }));
  const gradientId = `spark-${Math.random().toString(36).slice(2)}`;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

