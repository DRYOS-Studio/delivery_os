import { ExternalLink } from "lucide-react";
import {
  formatGitRepositoryLinkLabel,
  isSafeGitRepositoryUrl,
} from "@/lib/utils/git-repository-url";

type Props = {
  url: string;
  className?: string | undefined;
  variant?: "default" | "onDark";
};

export function OptionalHttpsLink({
  url,
  className = "",
  variant = "default",
}: Props): React.JSX.Element | null {
  if (!url || !isSafeGitRepositoryUrl(url)) return null;

  const label = formatGitRepositoryLinkLabel(url);
  const linkClass =
    variant === "onDark"
      ? "inline-flex items-center gap-1.5 text-sm text-bg/90 hover:text-bg underline-offset-2 hover:underline"
      : "inline-flex items-center gap-1.5 text-sm text-oak hover:underline font-medium";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${linkClass} ${className}`}
    >
      <ExternalLink className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="truncate max-w-[min(100%,28rem)]" title={url}>
        {label}
      </span>
    </a>
  );
}
