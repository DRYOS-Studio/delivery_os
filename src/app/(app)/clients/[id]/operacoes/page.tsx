import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OperationCard } from "@/components/domain/OperationCard";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { getProfile } from "@/lib/auth/server";
import { getActiveOperations } from "@/lib/db/queries/operations";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [operations, profile] = await Promise.all([
    getActiveOperations({ clientId: id, scope: "visivel" }),
    getProfile(),
  ]);
  const isAdmin = profile?.role === "admin";
  return (
    <section className="mb-9">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg text-ink font-semibold">Operações</h2>
          <Pill variant="neutral">{operations.length}</Pill>
        </div>
        {isAdmin && (
          <Link
            href={`/operations/new?clientId=${encodeURIComponent(id)}&returnTo=${encodeURIComponent(`/clients/${id}/operacoes`)}`}
          >
            <Button variant="sage" className="min-h-[44px]">
              <Plus className="w-4 h-4" strokeWidth={1.75} />
              Nova operação
            </Button>
          </Link>
        )}
      </div>
      {operations.length === 0 ? (
        <p className="text-sm text-mute">Nenhuma Operação pra este Cliente.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {operations.map((op) => (
            <OperationCard key={op.id} data={op} />
          ))}
        </div>
      )}
    </section>
  );
}
