import { redirect } from "next/navigation";
import { BriefingForm } from "@/components/domain/BriefingForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getBriefingByOperation } from "@/lib/db/queries/briefings";
import { getOperation } from "@/lib/db/queries/operations";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/operations");

  const [op, briefing] = await Promise.all([
    getOperation(id),
    getBriefingByOperation(id),
  ]);
  if (!op) redirect("/operations");
  if (op.status === "arquivada") redirect(`/operations/${id}/briefing`);

  const initialData = briefing?.latestVersion
    ? {
        contexto: briefing.latestVersion.contexto,
        objetivos: briefing.latestVersion.objetivos,
        escopo_incluido: briefing.latestVersion.escopo_incluido,
        escopo_excluido: briefing.latestVersion.escopo_excluido,
        premissas: briefing.latestVersion.premissas,
        riscos: briefing.latestVersion.riscos,
        stakeholders: briefing.latestVersion.stakeholders,
        observacoes: briefing.latestVersion.observacoes,
      }
    : null;

  return (
    <>
      <PageHeader
        title={initialData ? "Editar briefing" : "Novo briefing"}
        subtitle={`${op.client.name} · ${op.name}`}
      />
      {initialData ? (
        <BriefingForm
          mode="edit"
          operationId={op.id}
          initialData={initialData}
        />
      ) : (
        <BriefingForm mode="create" operationId={op.id} />
      )}
    </>
  );
}
