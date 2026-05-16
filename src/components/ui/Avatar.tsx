import { cn } from "@/lib/utils/cn";

export type AvatarSize = "sm" | "md" | "lg" | "xl";
export type AvatarColor = "oak" | "sage-deep" | "oak-light";

type AvatarProps = {
  initials: string;
  size?: AvatarSize;
  color?: AvatarColor;
  className?: string;
};

const SIZES: Record<AvatarSize, string> = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
};

const COLORS: Record<AvatarColor, string> = {
  oak: "bg-oak text-bg",
  "sage-deep": "bg-sage-deep text-bg",
  "oak-light": "bg-oak-light text-bg",
};

export function Avatar({
  initials,
  size = "md",
  color = "oak",
  className,
}: AvatarProps) {
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-display font-semibold leading-none shrink-0",
        SIZES[size],
        COLORS[color],
        className,
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}
