import { redirect } from "next/navigation";
import { PersonForm } from "@/components/domain/PersonForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { listClients } from "@/lib/db/queries/clients";
import {
  getPerson,
  personHasActiveAllocations,
} from "@/lib/db/queries/persons";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/persons");

  const [person, hasAllocs, clients] = await Promise.all([
    getPerson(id),
    personHasActiveAllocations(id),
    listClients(),
  ]);
  if (!person) redirect("/persons");

  const clientsForSelect = clients.map((c) => ({ id: c.id, name: c.name }));
  // Internas: bloqueia archive se há allocations. Externas: nunca bloqueado (FK SET NULL em frentes).
  const canArchive = person.kind === "external" ? true : !hasAllocs;

  return (
    <>
      <PageHeader title={`Editar — ${person.name}`} />
      <PersonForm
        mode="edit"
        initialData={person}
        clientsForSelect={clientsForSelect}
        canArchive={canArchive}
      />
    </>
  );
}
