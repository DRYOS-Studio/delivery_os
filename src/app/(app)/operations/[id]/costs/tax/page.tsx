import { notFound, redirect } from "next/navigation";
import { OperationTaxRateForm } from "@/components/domain/OperationTaxRateForm";
import { requireAdmin } from "@/lib/auth/server";
import { getOperation } from "@/lib/db/queries/operations";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OperationTaxRatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const profile = await requireAdmin();
  if (!profile) redirect(`/operations/${id}?tab=custos`);

  const operation = await getOperation(id);
  if (!operation) notFound();

  return (
    <main className="max-w-2xl px-4 py-8">
      <OperationTaxRateForm
        operationId={id}
        initialTaxRatePct={operation.taxRatePct ?? null}
      />
    </main>
  );
}
