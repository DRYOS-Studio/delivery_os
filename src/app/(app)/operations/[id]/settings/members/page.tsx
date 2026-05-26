import Link from "next/link";
import { notFound } from "next/navigation";
import { AddOperationMemberForm } from "@/components/domain/AddOperationMemberForm";
import { OperationMembersList } from "@/components/domain/OperationMembersList";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/auth/server";
import {
  listAssignableProfiles,
  listOperationMembers,
} from "@/lib/db/queries/operation-members";
import { getOperation } from "@/lib/db/queries/operations";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin(`/operations`);
  const { id } = await params;

  const [operation, members, candidates] = await Promise.all([
    getOperation(id),
    listOperationMembers(id),
    listAssignableProfiles(id),
  ]);
  if (!operation) notFound();

  return (
    <>
      <PageHeader
        title="Membros"
        subtitle={
          <>
            <span className="text-ink-soft">{operation.name}</span>
            <span className="mx-2 text-line-strong">·</span>
            <span>
              {members.length} {members.length === 1 ? "membro" : "membros"}{" "}
              atribuído{members.length === 1 ? "" : "s"}
            </span>
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

      <section className="space-y-6">
        {members.length === 0 ? (
          <div className="bg-card border border-line rounded p-7 text-center">
            <p className="font-body text-sm text-mute">
              Nenhum membro atribuído ainda. Use o formulário abaixo pra
              adicionar.
            </p>
          </div>
        ) : (
          <OperationMembersList items={members} operationId={id} />
        )}

        <div className="bg-card border border-line rounded p-5">
          <h2 className="font-display text-base text-ink font-semibold mb-3">
            Adicionar membro
          </h2>
          {candidates.length === 0 ? (
            <p className="font-body text-sm text-mute">
              Todos os membros disponíveis já foram atribuídos a esta Operação.
            </p>
          ) : (
            <AddOperationMemberForm
              operationId={id}
              candidates={candidates}
            />
          )}
        </div>
      </section>
    </>
  );
}
