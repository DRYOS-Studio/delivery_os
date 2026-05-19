import { Package } from "lucide-react";
import Link from "next/link";
import { ArchiveServiceProductButton } from "@/components/domain/ArchiveServiceProductButton";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type { ServiceProductRow } from "@/lib/db/queries/service-products";
import { formatCycleTypeShort } from "@/lib/utils/cycle-type";

export function ProductCard({
  product,
  isAdmin = false,
}: {
  product: ServiceProductRow;
  isAdmin?: boolean;
}): React.JSX.Element {
  const archived = product.archived_at !== null;

  return (
    <Card {...(archived ? { className: "opacity-60" } : {})}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-shrink-0 w-12 h-12 rounded flex items-center justify-center bg-oak-50 text-oak">
            <Package className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Pill variant="neutral">{product.slug}</Pill>
            {archived && <Pill variant="warning">Arquivado</Pill>}
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="font-display text-lg font-semibold text-ink leading-tight">
            {product.name}
          </h3>
          {product.default_cycle_type && (
            <p className="font-mono text-[10px] text-mute uppercase tracking-wide">
              {formatCycleTypeShort(product.default_cycle_type)}
            </p>
          )}
        </div>

        {product.description && (
          <p className="text-sm text-ink-soft line-clamp-3">
            {product.description}
          </p>
        )}

        {isAdmin && (
          <div className="flex items-center gap-2 pt-2 border-t border-line">
            <Link
              href={`/catalog/products/${product.id}/edit`}
              className="font-mono text-xs text-oak hover:underline"
            >
              Editar →
            </Link>
            <div className="ml-auto">
              <ArchiveServiceProductButton
                productId={product.id}
                productName={product.name}
                archivedAt={product.archived_at}
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
