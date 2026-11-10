import { Pencil } from "lucide-react";
import Link from "next/link";

type Props = {
  href: string;
  label?: string;
  /** Para testes e acessibilidade em listas. */
  "data-testid"?: string;
};

export function RowEditLink({
  href,
  label = "Editar",
  "data-testid": testId,
}: Props): React.JSX.Element {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded text-oak border border-line hover:bg-card hover:border-oak/40 transition-colors min-h-[32px]"
    >
      <Pencil className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
      {label}
    </Link>
  );
}
