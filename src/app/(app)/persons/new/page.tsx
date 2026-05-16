import { PersonForm } from "@/components/domain/PersonForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { listClients } from "@/lib/db/queries/clients";

export default async function Page() {
  const clients = await listClients();
  const clientsForSelect = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader
        title="Nova pessoa"
        subtitle="Interna (DRYOS) ou externa (cliente / parceiro)."
      />
      <PersonForm mode="create" clientsForSelect={clientsForSelect} />
    </>
  );
}
