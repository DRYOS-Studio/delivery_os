import { cn } from "@/lib/utils/cn";

export type PillVariant =
  | "neutral"
  | "oak"
  | "sage"
  | "ok"
  | "warning"
  | "critical";

type PillProps = {
  variant?: PillVariant;
  showDot?: boolean;
  children: React.ReactNode;
  className?: string;
};

const VARIANTS: Record<PillVariant, string> = {
  neutral: "bg-surface text-mute",
  oak: "bg-oak-50 text-oak",
  sage: "bg-sage-bg text-sage-deep",
  ok: "bg-ok-bg text-ok",
  warning: "bg-warning-bg text-warning",
  critical: "bg-critical-bg text-critical",
};

export function Pill({
  variant = "neutral",
  showDot,
  children,
  className,
}: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5",
        "font-mono text-[10px] font-medium rounded-pill",
        "whitespace-nowrap",
        VARIANTS[variant],
        className,
      )}
    >
      {showDot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
