import { ClientForm } from "@/components/domain/ClientForm";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function Page() {
  return (
    <>
      <PageHeader
        title="Novo cliente"
        subtitle="Cadastre um Cliente pra associar Operações e Pessoas."
      />
      <ClientForm mode="create" />
    </>
  );
}
