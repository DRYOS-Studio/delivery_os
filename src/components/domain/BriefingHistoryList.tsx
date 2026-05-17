import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type { BriefingVersionWithAuthor } from "@/lib/db/queries/briefings";
import { formatDateBR, relativeFromNow } from "@/lib/utils/date";
import { initialsFromEmail } from "@/lib/utils/initials";

const PREVIEW_FIELDS = [
  "contexto",
  "objetivos",
  "escopo_incluido",
  "premissas",
  "riscos",
  "observacoes",
] as const;

function pickPreview(v: BriefingVersionWithAuthor): string {
  for (const f of PREVIEW_FIELDS) {
    const value = v[f];
    if (value && value.trim().length > 0) {
      const trimmed = value.trim().replace(/\s+/g, " ");
      return trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed;
    }
  }
  return "Versão sem conteúdo.";
}

export function BriefingHistoryList({
  versions,
  currentVersionId,
  operationId,
}: {
  versions: BriefingVersionWithAuthor[];
  currentVersionId: string | null;
  operationId: string;
}): React.JSX.Element {
  if (versions.length === 0) {
    return (
      <Card>
        <p className="text-sm text-mute">Sem versões registradas ainda.</p>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {versions.map((v) => {
        const isCurrent = v.id === currentVersionId;
        const authorLabel = v.authorEmail ?? "Usuário removido";
        return (
          <li key={v.id}>
            <Card>
              <div className="flex items-start gap-3">
                <Avatar
                  size="sm"
                  initials={initialsFromEmail(v.authorEmail)}
                  color="oak"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isCurrent && <Pill variant="sage">Atual</Pill>}
                    <span className="font-mono text-xs text-mute">
                      {formatDateBR(v.created_at)} · {relativeFromNow(v.created_at)}
                    </span>
                    <span className="text-xs text-mute">por</span>
                    <span className="text-xs text-ink-soft">{authorLabel}</span>
                  </div>
                  <p className="text-sm text-ink-soft mt-2 line-clamp-2">
                    {pickPreview(v)}
                  </p>
                  <Link
                    href={`/operations/${operationId}/briefing/history/${v.id}`}
                    className="font-mono text-xs text-oak hover:underline inline-block mt-2"
                  >
                    Ver versão completa →
                  </Link>
                </div>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
