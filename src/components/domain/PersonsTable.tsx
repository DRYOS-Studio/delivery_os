import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import type { PersonListItem } from "@/lib/db/queries/persons";
import { getInitials } from "@/lib/utils/initials";

export function PersonsTable({
  persons,
  hasFilter,
}: {
  persons: PersonListItem[];
  hasFilter: boolean;
}) {
  if (persons.length === 0) {
    return (
      <div className="text-center py-14 border border-line rounded bg-card">
        {hasFilter ? (
          <>
            <p className="font-display text-lg text-mute">
              Nenhuma pessoa para esse filtro.
            </p>
            <Link
              href="/persons"
              className="inline-block mt-3 font-mono text-xs text-oak hover:underline"
            >
              limpar filtro
            </Link>
          </>
        ) : (
          <>
            <p className="font-display text-lg text-mute">
              Nenhuma pessoa cadastrada.
            </p>
            <Link href="/persons/new" className="inline-block mt-4">
              <Button variant="sage">Nova pessoa</Button>
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card border border-line rounded shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            <Th className="w-12" />
            <Th>Nome</Th>
            <Th>Tipo</Th>
            <Th>Especialidade / Papel</Th>
            <Th>E-mail</Th>
            <Th>Cliente</Th>
            <Th className="text-right">Ações</Th>
          </tr>
        </thead>
        <tbody>
          {persons.map((p) => (
            <tr
              key={p.id}
              className="border-b border-line last:border-b-0 hover:bg-surface transition-colors"
            >
              <Td className="w-12">
                <Avatar
                  size="sm"
                  initials={getInitials(p.name)}
                  color={p.kind === "internal" ? "oak" : "sage-deep"}
                />
              </Td>
              <Td className="font-medium text-ink">{p.name}</Td>
              <Td>
                <Pill variant={p.kind === "internal" ? "oak" : "sage"}>
                  {p.kind === "internal" ? "Interna" : "Externa"}
                </Pill>
              </Td>
              <Td className="font-mono text-xs text-mute">
                {p.kind === "internal" ? p.specialty ?? "—" : p.externalRole ?? "—"}
              </Td>
              <Td className="font-mono text-xs text-mute">
                {p.email ? (
                  <a href={`mailto:${p.email}`} className="hover:underline">
                    {p.email}
                  </a>
                ) : (
                  "—"
                )}
              </Td>
              <Td className="font-body text-sm text-ink-soft">
                {p.clientName ? (
                  <Link
                    href={`/clients/${p.clientId}`}
                    className="hover:underline"
                  >
                    {p.clientName}
                  </Link>
                ) : (
                  "—"
                )}
              </Td>
              <Td className="text-right">
                <Link
                  href={`/persons/${p.id}`}
                  className="text-oak hover:underline text-sm font-medium"
                >
                  Abrir →
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`font-mono text-[10px] uppercase tracking-wide text-mute font-medium px-4 py-3 text-left ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>;
}
