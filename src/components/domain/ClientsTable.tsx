import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { MobileListItem } from "@/components/ui/MobileListItem";
import { Pill } from "@/components/ui/Pill";
import type { ClientListItem } from "@/lib/db/queries/clients";
import { formatDateBR } from "@/lib/utils/date";

type Props = {
  clients: ClientListItem[];
  hasSearch: boolean;
  isAdmin?: boolean;
};

export function ClientsTable({ clients, hasSearch, isAdmin = true }: Props) {
  if (clients.length === 0) {
    return (
      <div className="text-center py-14 border border-line rounded bg-card">
        {hasSearch ? (
          <>
            <p className="font-display text-lg text-mute">
              Nenhum Cliente para essa busca.
            </p>
            <Link
              href="/clients"
              className="inline-block mt-3 font-mono text-xs text-oak hover:underline"
            >
              limpar busca
            </Link>
          </>
        ) : isAdmin ? (
          <>
            <p className="font-display text-lg text-mute">
              Nenhum Cliente cadastrado.
            </p>
            <Link href="/clients/new" className="inline-block mt-4">
              <Button variant="sage">Novo cliente</Button>
            </Link>
          </>
        ) : (
          <>
            <p className="font-display text-lg text-mute">
              Você ainda não vê nenhum Cliente.
            </p>
            <p className="font-mono text-xs text-mute mt-2">
              Clientes aparecem aqui quando você é atribuído a uma Operação
              deles.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Mobile: card list */}
      <ul className="md:hidden bg-card border border-line rounded shadow-sm overflow-hidden">
        {clients.map((c) => (
          <MobileListItem
            key={c.id}
            href={`/clients/${c.id}`}
            title={c.name}
            subtitle={c.slug}
            pills={
              <>
                <Pill variant="neutral">
                  {c.operationsActive} {c.operationsActive === 1 ? "Op" : "Ops"}
                </Pill>
                {c.externalPersons > 0 && (
                  <Pill variant="neutral">
                    {c.externalPersons} pessoa{c.externalPersons === 1 ? "" : "s"}
                  </Pill>
                )}
              </>
            }
            meta={formatDateBR(c.createdAt)}
          />
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden md:block bg-card border border-line rounded shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            <Th>Nome</Th>
            <Th>Slug</Th>
            <Th>Operações ativas</Th>
            <Th>Pessoas externas</Th>
            <Th>Criado em</Th>
            <Th className="text-right">Ações</Th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr
              key={c.id}
              className="border-b border-line last:border-b-0 hover:bg-surface transition-colors"
            >
              <Td className="font-medium text-ink">{c.name}</Td>
              <Td className="font-mono text-xs text-mute">{c.slug}</Td>
              <Td>
                <Pill variant="neutral">{c.operationsActive}</Pill>
              </Td>
              <Td>
                <Pill variant="neutral">{c.externalPersons}</Pill>
              </Td>
              <Td className="font-mono text-xs text-mute">
                {formatDateBR(c.createdAt)}
              </Td>
              <Td className="text-right">
                <Link
                  href={`/clients/${c.id}`}
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
    </>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
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
