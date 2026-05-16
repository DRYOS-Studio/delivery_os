import { cn } from "@/lib/utils/cn";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
};

export function Card({ children, className, interactive }: CardProps) {
  return (
    <div
      className={cn(
        "bg-card border border-line rounded shadow-sm p-5",
        interactive &&
          "cursor-pointer transition-all hover:shadow-md hover:-translate-y-px hover:border-line-strong",
        className,
      )}
    >
      {children}
    </div>
  );
}
