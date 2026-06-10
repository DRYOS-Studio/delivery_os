"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

export type MultiSelectOption = { id: string; name: string };

type Props = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  emptyText?: string;
};

/**
 * Seletor múltiplo: campo fechado com chips dos escolhidos + dropdown com busca
 * e checkboxes. Tailwind puro, sem libs. Fecha em click-outside / ESC.
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione…",
  disabled = false,
  id,
  emptyText = "Nenhuma opção.",
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const selected = useMemo(
    () => options.filter((o) => value.includes(o.id)),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery("");
  }, [open]);

  function toggle(optionId: string) {
    onChange(
      value.includes(optionId)
        ? value.filter((v) => v !== optionId)
        : [...value, optionId],
    );
  }

  function remove(optionId: string) {
    onChange(value.filter((v) => v !== optionId));
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full min-h-[38px] flex items-center gap-2 bg-card border border-line rounded px-3 py-1.5",
          "text-sm text-left focus:outline-none focus:border-line-strong",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          open && "border-line-strong",
        )}
      >
        <span className="flex-1 flex flex-wrap gap-1 min-w-0">
          {selected.length === 0 ? (
            <span className="text-mute-soft">{placeholder}</span>
          ) : (
            selected.map((o) => (
              <span
                key={o.id}
                className="inline-flex items-center gap-1 bg-surface text-ink-soft rounded-pill pl-2 pr-1 py-0.5 text-xs"
              >
                {o.name}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remover ${o.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) remove(o.id);
                  }}
                  className="inline-flex items-center justify-center rounded-full hover:bg-line p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" strokeWidth={2} />
                </span>
              </span>
            ))
          )}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-mute shrink-0 transition-transform",
            open && "rotate-180",
          )}
          strokeWidth={1.75}
        />
      </button>

      {open && (
        <div
          className="absolute z-20 mt-1 w-full bg-card border border-line rounded shadow-md overflow-hidden"
          id={listboxId}
        >
          <div className="flex items-center gap-2 px-2.5 py-2 border-b border-line">
            <Search className="w-3.5 h-3.5 text-mute-soft shrink-0" strokeWidth={1.75} />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="buscar…"
              className="w-full bg-transparent text-sm text-ink-soft placeholder:text-mute-soft focus:outline-none"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1" role="listbox" aria-multiselectable>
            {filtered.length === 0 ? (
              <li className="px-3 py-2 font-mono text-[10px] text-mute-soft">
                {options.length === 0 ? emptyText : "Nada encontrado."}
              </li>
            ) : (
              filtered.map((o) => {
                const isChecked = value.includes(o.id);
                return (
                  <li key={o.id} role="option" aria-selected={isChecked}>
                    <button
                      type="button"
                      onClick={() => toggle(o.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-ink-soft hover:bg-surface"
                    >
                      <span
                        className={cn(
                          "inline-flex items-center justify-center w-4 h-4 rounded border shrink-0",
                          isChecked
                            ? "bg-oak border-oak text-white"
                            : "border-line",
                        )}
                      >
                        {isChecked && (
                          <Check className="w-3 h-3" strokeWidth={3} />
                        )}
                      </span>
                      {o.name}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
