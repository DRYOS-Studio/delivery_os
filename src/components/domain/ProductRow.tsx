import { Package } from "lucide-react";
import Link from "next/link";
import { ArchiveServiceProductButton } from "@/components/domain/ArchiveServiceProductButton";
import { Pill } from "@/components/ui/Pill";
import type { ServiceProductRow } from "@/lib/db/queries/service-products";
import { formatCycleTypeShort } from "@/lib/utils/cycle-type";

export function ProductRow({
  product,
  isAdmin = false,
}: {
  product: ServiceProductRow;
  isAdmin?: boolean;
}): React.JSX.Element {
  const archived = product.archived_at !== null;

  return (
    <div
      className={`grid items-center gap-3 px-4 py-3 grid-cols-[2rem_1fr_auto] ${
        archived ? "opacity-60" : ""
      }`}
    >
      <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-oak-50 text-oak">
        <Package className="w-4 h-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex items-center gap-3 flex-wrap">
        <h3 className="font-display text-sm font-semibold text-ink truncate">
          {product.name}
        </h3>
        <Pill variant="neutral">{product.slug}</Pill>
        {product.default_cycle_type && (
          <span className="font-mono text-[10px] text-mute uppercase tracking-wide">
            {formatCycleTypeShort(product.default_cycle_type)}
          </span>
        )}
        {archived && <Pill variant="warning">Arquivado</Pill>}
      </div>
      {isAdmin && (
        <div className="flex items-center gap-2">
          <Link
            href={`/catalog/products/${product.id}/edit`}
            className="font-mono text-xs text-oak hover:underline"
          >
            Editar →
          </Link>
          <ArchiveServiceProductButton
            productId={product.id}
            productName={product.name}
            archivedAt={product.archived_at}
          />
        </div>
      )}
    </div>
  );
}
