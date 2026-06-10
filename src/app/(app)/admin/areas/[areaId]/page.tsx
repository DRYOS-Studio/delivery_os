import { notFound } from "next/navigation";
import { AreaGrantsManager } from "@/components/domain/AreaGrantsManager";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { requireAdmin } from "@/lib/auth/server";
import { getArea } from "@/lib/db/queries/areas";
import {
  listAreaClients,
  listAreaOperations,
  listGrantableClients,
  listGrantableOperations,
} from "@/lib/db/queries/area-grants";

export default async function Page({
  params,
}: {
  params: Promise<{ areaId: string }>;
}) {
  await requireAdmin();
  const { areaId } = await params;
  const area = await getArea(areaId);
  if (!area) notFound();

  const [grantedClients, grantedOps, allClients, allOps] = await Promise.all([
    listAreaClients(areaId),
    listAreaOperations(areaId),
    listGrantableClients(),
    listGrantableOperations(),
  ]);

  const clientOptions = allClients.map((c) => ({ id: c.id, name: c.name }));
  const opOptions = allOps.map((o) => ({
    id: o.id,
    name: `${o.name} · ${o.clientName}`,
  }));

  return (
    <>
      <PageHeader
        title={`Área: ${area.name}`}
        subtitle="Conceda acesso de leitura a clientes inteiros e/ou operações específicas. Quem é da área enxerga o painel do que for concedido."
      />
      {area.archivedAt && (
        <div className="mb-4">
          <Pill variant="warning">
            Área arquivada — não concede acesso enquanto arquivada
          </Pill>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        <section className="space-y-2">
          <h2 className="font-display text-base font-semibold text-ink">
            Clientes concedidos
          </h2>
          <p className="font-mono text-[10px] text-mute-soft">
            Cliente inteiro = todas as operações dele.
          </p>
          <AreaGrantsManager
            areaId={areaId}
            kind="client"
            options={clientOptions}
            grantedIds={grantedClients.map((c) => c.id)}
          />
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-base font-semibold text-ink">
            Operações concedidas
          </h2>
          <p className="font-mono text-[10px] text-mute-soft">
            Operação específica (além das já cobertas por cliente).
          </p>
          <AreaGrantsManager
            areaId={areaId}
            kind="operation"
            options={opOptions}
            grantedIds={grantedOps.map((o) => o.id)}
          />
        </section>
      </div>
    </>
  );
}
