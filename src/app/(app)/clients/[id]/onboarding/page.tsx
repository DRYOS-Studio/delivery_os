import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { getClient } from "@/lib/db/queries/clients";
import { getActiveOperations } from "@/lib/db/queries/operations";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientOnboardingPickPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const { returnTo } = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const client = await getClient(id);
  if (!client) notFound();

  const operations = await getActiveOperations({ clientId: id, scope: "visivel" });
  const back = returnTo?.startsWith("/clients/") ? returnTo : `/clients/${id}`;

  return (
    <>
      <PageHeader
        title="Agendar onboarding"
        subtitle={client.name}
        actions={
          <Link href={back}>
            <Button variant="ghost">Voltar</Button>
          </Link>
        }
      />
      <p className="text-sm text-mute mb-4">
        Escolha em qual Operação criar a reunião de onboarding.
      </p>
      <ul className="bg-card border border-line rounded divide-y divide-line">
        {operations.map((op) => (
          <li key={op.id}>
            <Link
              href={`/operations/${op.id}/meetings/new?kind=onboarding&returnTo=${encodeURIComponent(back)}`}
              className="block px-4 py-4 hover:bg-surface/60 min-h-[44px]"
            >
              <p className="font-medium text-ink-soft">{op.operationName}</p>
              <p className="font-mono text-[10px] text-mute uppercase mt-1">
                {op.productLine} · {op.status}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {operations.length === 0 && (
        <p className="text-sm text-mute mb-4">
          Nenhuma Operação ativa. Crie uma antes de agendar.
        </p>
      )}
      <Link
        href={`/operations/new?clientId=${encodeURIComponent(id)}&returnTo=${encodeURIComponent(back)}`}
      >
        <Button variant="sage" className="mt-4 min-h-[44px]">
          Nova operação
        </Button>
      </Link>
    </>
  );
}
