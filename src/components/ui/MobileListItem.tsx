import { ChevronRight } from "lucide-react";
import Link from "next/link";

type Props = {
  href: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  pills?: React.ReactNode;
  meta?: React.ReactNode;
  trailingValue?: React.ReactNode;
};

export function MobileListItem({
  href,
  title,
  subtitle,
  pills,
  meta,
  trailingValue,
}: Props) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0 hover:bg-surface transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="font-medium text-ink truncate">{title}</div>
          {subtitle && (
            <div className="font-mono text-[10px] text-mute mt-0.5 truncate">
              {subtitle}
            </div>
          )}
          {pills && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {pills}
            </div>
          )}
          {meta && (
            <div className="font-mono text-[10px] text-mute mt-1">{meta}</div>
          )}
        </div>
        {trailingValue && (
          <div className="font-mono text-xs text-mute shrink-0">
            {trailingValue}
          </div>
        )}
        <ChevronRight
          className="w-4 h-4 text-mute shrink-0"
          strokeWidth={1.75}
          aria-hidden
        />
      </Link>
    </li>
  );
}
