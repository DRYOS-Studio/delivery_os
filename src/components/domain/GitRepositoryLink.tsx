import { ExternalLink } from "lucide-react";
import {
  formatGitRepositoryLinkLabel,
  isSafeGitRepositoryUrl,
} from "@/lib/utils/git-repository-url";
import {
  GIT_REPOSITORY_SCOPE_LABEL,
  type GitRepositoryScope,
} from "@/lib/utils/resolve-git-repository-url";

type Props = {
  url: string;
  scope?: GitRepositoryScope | undefined;
  className?: string | undefined;
  /** No hero escuro da Operação, texto claro. */
  variant?: "default" | "onDark";
};

export function GitRepositoryLink({
  url,
  scope,
  className = "",
  variant = "default",
}: Props): React.JSX.Element | null {
  if (!url || !isSafeGitRepositoryUrl(url)) return null;

  const label = formatGitRepositoryLinkLabel(url);
  const scopeHint = scope ? GIT_REPOSITORY_SCOPE_LABEL[scope] : null;

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
      {scopeHint && (
        <span
          className={
            variant === "onDark"
              ? "font-mono text-[10px] uppercase tracking-wide opacity-70"
              : "font-mono text-[10px] uppercase tracking-wide text-mute"
          }
        >
          · {scopeHint}
        </span>
      )}
    </a>
  );
}
