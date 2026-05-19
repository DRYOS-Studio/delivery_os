import { Avatar, type AvatarColor } from "@/components/ui/Avatar";
import type { TeamPerson } from "@/lib/db/queries/public-report";
import { getInitials } from "@/lib/utils/initials";

const COLOR_CYCLE: AvatarColor[] = ["oak", "sage-deep", "oak-light"];

function colorForIndex(i: number): AvatarColor {
  return COLOR_CYCLE[i % COLOR_CYCLE.length] ?? "oak";
}

export function PublicTeamGrid({
  people,
}: {
  people: TeamPerson[];
}): React.JSX.Element {
  if (people.length === 0) return <></>;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-lg text-ink font-semibold">
          Quem cuida da sua operação
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wide text-mute">
          {people.length} {people.length === 1 ? "pessoa" : "pessoas"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {people.map((p, i) => (
          <div
            key={p.personId}
            className="bg-card border border-line rounded p-4 flex flex-col items-center text-center gap-2"
          >
            <Avatar
              initials={getInitials(p.name)}
              size="lg"
              color={colorForIndex(i)}
            />
            <div className="min-w-0 w-full">
              <p className="font-display text-sm font-semibold text-ink truncate">
                {p.name}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wide text-mute truncate">
                {p.roleLabel}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
