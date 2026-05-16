import type { ExternalPersonItem } from "@/lib/db/queries/persons";

export function ExternalPersonsList({
  persons,
}: {
  persons: ExternalPersonItem[];
}) {
  if (persons.length === 0) {
    return (
      <p className="text-sm text-mute">
        Nenhuma pessoa externa cadastrada pra este Cliente.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {persons.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between bg-card border border-line rounded px-4 py-3"
        >
          <div className="flex flex-col">
            <span className="font-body text-sm text-ink">{p.name}</span>
            <span className="font-mono text-xs text-mute">
              {p.externalRole}
            </span>
          </div>
          {p.email && (
            <a
              href={`mailto:${p.email}`}
              className="font-mono text-xs text-oak hover:underline"
            >
              {p.email}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
