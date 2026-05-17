import { CreatePublicLinkForm } from "@/components/domain/CreatePublicLinkForm";
import { RevokePublicLinkButton } from "@/components/domain/RevokePublicLinkButton";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { Pill } from "@/components/ui/Pill";
import type { PublicLinkListItem } from "@/lib/db/queries/publicLinks";
import { formatDateBR, relativeFromNow } from "@/lib/utils/date";

export function PublicLinksSection({
  links,
  operationId,
  baseUrl,
}: {
  links: PublicLinkListItem[];
  operationId: string;
  baseUrl: string;
}): React.JSX.Element {
  const activeCount = links.filter((l) => l.revokedAt === null).length;
  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">
          Acesso público
        </h2>
        <Pill variant="neutral">
          {activeCount} {activeCount === 1 ? "ativo" : "ativos"}
        </Pill>
      </div>

      <div className="space-y-4">
        <CreatePublicLinkForm operationId={operationId} />

        {links.length === 0 ? (
          <Card>
            <p className="text-sm text-mute text-center py-2">
              Nenhum link gerado. Crie um pra compartilhar a Operação com o
              cliente.
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {links.map((l) => (
              <PublicLinkRow
                key={l.id}
                link={l}
                url={`${baseUrl}/public/${l.token}`}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PublicLinkRow({
  link,
  url,
}: {
  link: PublicLinkListItem;
  url: string;
}) {
  const isRevoked = link.revokedAt !== null;
  return (
    <li className="bg-card border border-line rounded px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {link.label && (
              <span className="font-body text-sm font-medium text-ink">
                {link.label}
              </span>
            )}
            {isRevoked ? (
              <Pill variant="critical">Revogado</Pill>
            ) : (
              <Pill variant="sage">Ativo</Pill>
            )}
          </div>
          <p
            className={`font-mono text-xs ${isRevoked ? "text-mute-soft line-through" : "text-ink-soft"} truncate`}
          >
            {url}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {!isRevoked && <CopyButton text={url} label="Copiar URL" />}
          {!isRevoked && (
            <RevokePublicLinkButton linkId={link.id} label={link.label} />
          )}
        </div>
      </div>

      <p className="font-mono text-[10px] text-mute-soft">
        Criado em {formatDateBR(link.createdAt)}
        {link.lastAccessedAt
          ? ` · Último acesso ${relativeFromNow(link.lastAccessedAt)}`
          : " · Sem acessos"}
        {isRevoked && link.revokedAt
          ? ` · Revogado ${relativeFromNow(link.revokedAt)}`
          : ""}
      </p>
    </li>
  );
}
