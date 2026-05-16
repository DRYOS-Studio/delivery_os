import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

type Props = {
  title: string;
  subtitle?: string;
  comingIn: string;
};

export function PlaceholderSection({ title, subtitle, comingIn }: Props) {
  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">{title}</h2>
        <Pill variant="warning">Em construção · {comingIn}</Pill>
      </div>
      <Card>
        <p className="font-body text-sm text-mute">
          {subtitle ?? "Esta seção aparecerá quando a feature correspondente for entregue."}
        </p>
      </Card>
    </section>
  );
}
