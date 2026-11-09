import { GitRepositoryLink } from "@/components/domain/GitRepositoryLink";
import type { RepositoryLinkRow } from "@/lib/db/queries/repository-links";
import {
  REPOSITORY_SCOPE_LABEL,
  repositoryLinkScope,
} from "@/lib/utils/repository-link-scope";

type Props = {
  links: RepositoryLinkRow[];
  variant?: "default" | "onDark";
  emptyMessage?: string | undefined;
};

export function RepositoryLinksList({
  links,
  variant = "default",
  emptyMessage,
}: Props): React.JSX.Element | null {
  if (links.length === 0) {
    if (!emptyMessage) return null;
    return <p className="text-sm text-mute">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-2">
      {links.map((link) => {
        const scope = repositoryLinkScope({
          operationId: link.operationId,
          frenteId: link.frenteId,
        });
        return (
          <li
            key={link.id}
            className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3"
          >
            <span className="text-sm font-medium text-ink min-w-[6rem]">
              {link.label}
            </span>
            <GitRepositoryLink
              url={link.url}
              scope={scope}
              variant={variant}
            />
            {link.notes && (
              <span className="text-xs text-mute sm:ml-auto">{link.notes}</span>
            )}
            <span className="sr-only">
              Escopo {REPOSITORY_SCOPE_LABEL[scope]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
