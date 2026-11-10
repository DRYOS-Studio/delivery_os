import { Trash2 } from "lucide-react";

type Props = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  confirmMessage?: string;
  /** Texto do botão; default "Excluir". */
  actionLabel?: string;
};

export function RowDeleteButton({
  label,
  onClick,
  disabled,
  busy,
  confirmMessage,
  actionLabel = "Excluir",
}: Props): React.JSX.Element {
  function handleClick() {
    const msg =
      confirmMessage ??
      `Excluir "${label}"? Esta ação não pode ser desfeita.`;
    if (!globalThis.confirm(msg)) return;
    onClick();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded text-critical border border-line hover:bg-critical-bg disabled:opacity-50 transition-colors min-h-[32px]"
    >
      <Trash2 className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
      {busy ? "…" : actionLabel}
    </button>
  );
}
