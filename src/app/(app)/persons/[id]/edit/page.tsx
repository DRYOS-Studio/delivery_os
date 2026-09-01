import { redirect } from "next/navigation";
import { PersonForm } from "@/components/domain/PersonForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile } from "@/lib/auth/server";
import { listClients } from "@/lib/db/queries/clients";
import {
  getPerson,
  countActiveAllocationsByPerson,
} from "@/lib/db/queries/persons";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/persons");

  const [person, activeAllocs, clients] = await Promise.all([
    getPerson(id),
    countActiveAllocationsByPerson(id),
    listClients(),
  ]);
  if (!person) redirect("/persons");

  const clientsForSelect = clients.map((c) => ({ id: c.id, name: c.name }));
  // Internas: bloqueia archive se há alocação ABERTA. Externas: nunca bloqueado
  // (FK SET NULL em frentes). Alocação encerrada é histórico, não impedimento.
  const bloqueada = person.kind === "internal" && activeAllocs > 0;
  const canArchive = !bloqueada;

  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  return (
    <>
      <PageHeader title={`Editar — ${person.name}`} />
      <PersonForm
        mode="edit"
        initialData={person}
        clientsForSelect={clientsForSelect}
        canArchive={canArchive}
        archiveBlockedReason={
          bloqueada
            ? `${activeAllocs} ${activeAllocs === 1 ? "alocação aberta" : "alocações abertas"} — encerre-${activeAllocs === 1 ? "a" : "as"} antes.`
            : null
        }
        isAdmin={isAdmin}
      />
    </>
  );
}
