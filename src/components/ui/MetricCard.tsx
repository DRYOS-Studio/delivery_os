import { Pill, type PillVariant } from "@/components/ui/Pill";
import { cn } from "@/lib/utils/cn";

type Props = {
  label: string;
  value: number | string;
  hint?: string;
  variant?: PillVariant;
  size?: "default" | "lg";
};

export function MetricCard({
  label,
  value,
  hint,
  variant,
  size = "default",
}: Props) {
  return (
    <div className="flex flex-col gap-1 p-5 bg-surface border border-line rounded-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wide text-mute">
          {label}
        </p>
        {variant && (
          <Pill variant={variant}>
            {variant === "sage"
              ? "ok"
              : variant === "warning"
                ? "atenção"
                : variant === "critical"
                  ? "crítico"
                  : ""}
          </Pill>
        )}
      </div>
      <p
        className={cn(
          "font-display font-semibold text-ink",
          size === "lg" ? "text-4xl" : "text-3xl",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-mute">{hint}</p>}
    </div>
  );
}
