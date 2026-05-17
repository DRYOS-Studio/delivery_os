import { AssignVillainForm } from "@/components/domain/AssignVillainForm";
import { OperationVillainRow } from "@/components/domain/OperationVillainRow";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type {
  AvailableVillain,
  OperationVillainListItem,
} from "@/lib/db/queries/operation-villains";

export function OperationVillainsSection({
  items,
  availableVillains,
  operationId,
}: {
  items: OperationVillainListItem[];
  availableVillains: AvailableVillain[];
  operationId: string;
}): React.JSX.Element {
  return (
    <section className="mb-9">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg text-ink font-semibold">
            Vilões em luta
          </h2>
          <Pill variant="neutral">{items.length}</Pill>
        </div>
        <AssignVillainForm
          operationId={operationId}
          availableVillains={availableVillains}
        />
      </div>

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-mute text-center py-2">
            Nenhum vilão atribuído. Atribua o primeiro pra começar a narrativa
            de luta.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <OperationVillainRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
