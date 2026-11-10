import Link from "next/link";
import { notFound } from "next/navigation";
import { OperationNtfyTopicsPanel } from "@/components/domain/OperationNtfyTopicsPanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { listNtfyTopicsByOperation } from "@/lib/db/queries/operation-ntfy-topics";
import { getOperation } from "@/lib/db/queries/operations";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [operation, topics] = await Promise.all([
    getOperation(id),
    listNtfyTopicsByOperation(id),
  ]);
  if (!operation) notFound();

  return (
    <>
      <PageHeader
        title="Alertas ntfy"
        subtitle={
          <>
            <span className="text-ink-soft">{operation.name}</span>
            <span className="mx-2 text-line-strong">·</span>
            <span>{operation.client.name}</span>
          </>
        }
        actions={
          <Link
            href={`/operations/${id}`}
            className="font-mono text-xs text-oak hover:underline"
          >
            ← Voltar pra Operação
          </Link>
        }
      />
      <OperationNtfyTopicsPanel operationId={id} topics={topics} />
    </>
  );
}
