import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { StalenessPill } from "@/components/ui/StalenessPill";
import type { FrenteAttentionItem } from "@/lib/db/queries/frentes";
import { getInitials } from "@/lib/utils/initials";

function truncate(s: string, n = 80): string {
  const cleaned = s.trim().replace(/\s+/g, " ");
  return cleaned.length <= n ? cleaned : `${cleaned.slice(0, n)}…`;
}

export function FrentesAttentionSection({
  frentes,
  hotCriticalCount,
}: {
  frentes: FrenteAttentionItem[];
  hotCriticalCount: number;
}): React.JSX.Element {
  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">
          Frentes pedindo atenção
        </h2>
        {hotCriticalCount > 0 && (
          <Pill variant="critical">{hotCriticalCount} críticas</Pill>
        )}
      </div>

      {frentes.length === 0 ? (
        <Card>
          <p className="text-sm text-mute text-center py-2">
            Tudo em dia. Nenhuma Frente com mais de 7 dias sem atualização.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {frentes.map((f) => (
            <li key={f.id}>
              <Card>
                <div className="flex items-start gap-3">
                  <Avatar
                    size="sm"
                    initials={
                      f.responsible ? getInitials(f.responsible.name) : "?"
                    }
                    color={f.responsible ? "oak" : "sage-deep"}
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/operations/${f.operation.id}/frentes/${f.id}/edit`}
                        className="font-display text-base font-semibold text-ink hover:underline"
                      >
                        {f.name}
                      </Link>
                      <Pill variant="oak">
                        Tipo {f.cycleType.toUpperCase()}
                      </Pill>
                      <StalenessPill since={f.actionableStatusSince} />
                    </div>
                    <p className="font-mono text-[11px] text-mute">
                      <Link
                        href={`/operations/${f.operation.id}`}
                        className="hover:underline"
                      >
                        {f.operation.name}
                      </Link>{" "}
                      · {f.client.name}
                      {f.responsible && <> · {f.responsible.name}</>}
                    </p>
                    <p className="text-sm text-ink-soft line-clamp-2">
                      {truncate(f.actionableStatus, 120)}
                    </p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
