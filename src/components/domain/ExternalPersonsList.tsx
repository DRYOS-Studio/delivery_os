import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import type { ExternalPersonItem } from "@/lib/db/queries/persons";
import { getInitials } from "@/lib/utils/initials";

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
          className="flex items-center gap-3 bg-card border border-line rounded px-4 py-3"
        >
          <Avatar size="sm" initials={getInitials(p.name)} color="sage-deep" />
          <div className="flex flex-col flex-1 min-w-0">
            <Link
              href={`/persons/${p.id}`}
              className="font-body text-sm text-ink hover:underline truncate"
            >
              {p.name}
            </Link>
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
