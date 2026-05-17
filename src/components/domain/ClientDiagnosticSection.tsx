import { FileSearch, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import type { DiagnosticRow } from "@/lib/db/queries/diagnostics";
import { formatDateBR } from "@/lib/utils/date";

const PRODUCT_LABEL: Record<"core" | "spark" | "studio", string> = {
  core: "Core",
  spark: "Spark",
  studio: "Studio",
};

const PRODUCT_VARIANT: Record<"core" | "spark" | "studio", PillVariant> = {
  core: "oak",
  spark: "sage",
  studio: "ok",
};

export function ClientDiagnosticSection({
  diagnostic,
  clientId,
}: {
  diagnostic: DiagnosticRow | null;
  clientId: string;
}): React.JSX.Element {
  return (
    <section className="mb-9">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">
          Diagnóstico
        </h2>
        <Link
          href={`/clients/${clientId}/diagnostic/edit`}
          className="inline-flex items-center gap-1.5 rounded font-medium px-2.5 py-1.5 text-xs bg-sage-bg text-sage-deep hover:bg-sage hover:text-bg transition-colors"
        >
          {diagnostic ? (
            <>
              <Pencil className="w-3 h-3" strokeWidth={1.75} />
              Editar
            </>
          ) : (
            <>
              <Plus className="w-3 h-3" strokeWidth={1.75} />
              Registrar
            </>
          )}
        </Link>
      </div>

      {diagnostic ? (
        <Card>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <FileSearch
                className="w-5 h-5 text-mute flex-shrink-0 mt-0.5"
                strokeWidth={1.75}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink-soft whitespace-pre-wrap">
                  {diagnostic.notes}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap pl-8 font-mono text-[10px] text-mute">
              {diagnostic.recommended_product && (
                <Pill
                  variant={PRODUCT_VARIANT[diagnostic.recommended_product]}
                >
                  Produto recomendado:{" "}
                  {PRODUCT_LABEL[diagnostic.recommended_product]}
                </Pill>
              )}
              {diagnostic.conducted_at && (
                <span>Conduzido em {formatDateBR(diagnostic.conducted_at)}</span>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-mute text-center py-2">
            Cliente sem diagnóstico registrado. Registre antes de criar a
            Operação para vincular.
          </p>
        </Card>
      )}
    </section>
  );
}
