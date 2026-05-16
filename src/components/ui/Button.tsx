import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "ghost" | "sage";
export type ButtonSize = "sm" | "md";

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-bg hover:bg-oak",
  ghost:
    "bg-card text-ink-soft border border-line-strong hover:bg-surface hover:border-ink",
  sage: "bg-sage text-ink hover:bg-sage-deep hover:text-bg",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-[11px]",
  md: "px-3.5 py-2 text-[13px]",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center gap-2 rounded font-medium transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
}
