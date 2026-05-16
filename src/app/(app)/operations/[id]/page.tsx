import { notFound } from "next/navigation";
import { FinanceCards } from "@/components/domain/FinanceCards";
import { FrentesListSection } from "@/components/domain/FrentesListSection";
import { OperationHero } from "@/components/domain/OperationHero";
import { PlaceholderSection } from "@/components/domain/PlaceholderSection";
import { getOperation } from "@/lib/db/queries/operations";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const op = await getOperation(id);
  if (!op) notFound();

  return (
    <>
      <OperationHero op={op} />

      <PlaceholderSection
        title="Vilões em luta"
        subtitle="Quando o Diagnóstico estiver pronto, os vilões da Operação aparecem aqui com progresso e quick wins."
        comingIn="sem 04"
      />

      <FrentesListSection frentes={op.frentes} />

      <PlaceholderSection
        title="Briefing vivo"
        subtitle="O briefing estruturado da Operação, com histórico de alterações."
        comingIn="sem 03"
      />

      <PlaceholderSection
        title="Reuniões e decisões"
        subtitle="Timeline de reuniões com cliente + decisões estruturadas com visibility própria."
        comingIn="sem 03"
      />

      <FinanceCards op={op} />

      <PlaceholderSection
        title="Credenciais"
        subtitle="Referências pro Bitwarden (ou Vaultwarden self-host). Adiada na v2."
        comingIn="v2 (AD-009)"
      />
    </>
  );
}
