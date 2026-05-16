"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

export function OperationsSearch({
  initialQuery,
}: {
  initialQuery: string;
}): React.JSX.Element {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const debounced = useDebouncedValue(query, 300);
  const skipFirstEffect = useRef(true);

  useEffect(() => {
    if (skipFirstEffect.current) {
      skipFirstEffect.current = false;
      return;
    }
    const trimmed = debounced.trim();
    const target = trimmed
      ? `/operations?q=${encodeURIComponent(trimmed)}`
      : "/operations";
    router.replace(target);
  }, [debounced, router]);

  return (
    <div className="relative w-full max-w-md mb-5">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mute"
        strokeWidth={1.75}
      />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por operação ou cliente…"
        className="w-full bg-card border border-line rounded pl-9 pr-3 py-2 text-sm text-ink-soft placeholder:text-mute-soft focus:outline-none focus:border-line-strong"
      />
    </div>
  );
}
