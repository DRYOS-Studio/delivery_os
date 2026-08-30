import { Edit2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PersonAllocationsSection } from "@/components/domain/PersonAllocationsSection";
import { PersonClientSection } from "@/components/domain/PersonClientSection";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { getClient } from "@/lib/db/queries/clients";
import { getActiveOperations } from "@/lib/db/queries/operations";
import {
  getPerson,
  getPersonAllocations,
} from "@/lib/db/queries/persons";
import { getInitials } from "@/lib/utils/initials";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const person = await getPerson(id);
  if (!person) notFound();

  const isInternal = person.kind === "internal";

  return (
    <>
      <div className="flex items-start justify-between mb-7">
        <div className="flex items-start gap-4">
          <Avatar
            size="xl"
            initials={getInitials(person.name)}
            color={isInternal ? "oak" : "sage-deep"}
          />
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink leading-tight">
              {person.name}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Pill variant={isInternal ? "oak" : "sage"}>
                {isInternal ? "Interna" : "Externa"}
              </Pill>
              <span className="font-mono text-xs text-mute">
                {isInternal ? person.specialty : person.external_role}
              </span>
            </div>
            {person.email && (
              <a
                href={`mailto:${person.email}`}
                className="block mt-2 font-mono text-xs text-oak hover:underline"
              >
                {person.email}
              </a>
            )}
          </div>
        </div>
        <Link href={`/persons/${person.id}/edit`}>
          <Button variant="ghost">
            <Edit2 className="w-4 h-4" strokeWidth={1.75} />
            Editar
          </Button>
        </Link>
      </div>

      {isInternal ? (
        <InternalDetail personId={person.id} />
      ) : (
        <ExternalDetail clientId={person.client_id} />
      )}
    </>
  );
}

async function InternalDetail({ personId }: { personId: string }) {
  const allocations = await getPersonAllocations(personId);
  return <PersonAllocationsSection allocations={allocations} />;
}

async function ExternalDetail({
  clientId,
}: {
  clientId: string | null;
}) {
  if (!clientId) {
    return (
      <PageHeader
        title="Cliente não vinculado"
        subtitle="Pessoa externa sem Cliente — verifique cadastro."
      />
    );
  }
  const [client, operations] = await Promise.all([
    getClient(clientId),
    getActiveOperations({ clientId, scope: "visivel" }),
  ]);
  if (!client) {
    return (
      <p className="text-sm text-mute">
        Cliente foi arquivado ou não existe mais.
      </p>
    );
  }
  return (
    <PersonClientSection
      client={{ id: client.id, name: client.name, slug: client.slug }}
      operations={operations}
    />
  );
}
