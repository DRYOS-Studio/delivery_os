import { Pill } from "@/components/ui/Pill";
import { stalenessLabel } from "@/lib/utils/staleness";

export function StalenessPill({
  since,
}: {
  since: string | null | undefined;
}): React.JSX.Element | null {
  const label = stalenessLabel(since);
  if (!label) return null;
  return <Pill variant={label.variant}>{label.text}</Pill>;
}
