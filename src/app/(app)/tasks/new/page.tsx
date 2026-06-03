import Link from "next/link";
import { TaskQuickCreateForm } from "@/components/domain/TaskQuickCreateForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { requireUser } from "@/lib/auth/server";
import { listOperationsWithFrentes } from "@/lib/db/queries/operations";
import { listInternalPersons } from "@/lib/db/queries/persons";

export default async function Page() {
  await requireUser();
  const [operations, assignees] = await Promise.all([
    listOperationsWithFrentes(),
    listInternalPersons(),
  ]);

  return (
    <>
      <PageHeader
        title="Nova tarefa"
        subtitle="Escolha a Operação e a Frente onde a tarefa entra"
      />
      {operations.length === 0 ? (
        <div className="bg-card border border-line rounded p-7 text-center">
          <p className="font-body text-sm text-mute">
            Nenhuma Operação com Frente ativa disponível pra você. Crie uma
            Frente numa Operação antes de adicionar tarefas.
          </p>
          <div className="mt-4">
            <Link href="/tasks">
              <Button variant="ghost" type="button">
                Voltar
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <TaskQuickCreateForm operations={operations} assignees={assignees} />
      )}
    </>
  );
}
