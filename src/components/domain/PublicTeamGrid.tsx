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
    <section className="mb-12">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2
          className="font-display text-2xl font-semibold text-ink"
          style={{ letterSpacing: "-0.02em" }}
        >
          Quem cuida da sua operação
        </h2>
        <span className="font-mono text-[11px] text-mute px-3 py-1 rounded-pill bg-surface">
          {people.length} {people.length === 1 ? "pessoa" : "pessoas"}
        </span>
      </div>

      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        {people.map((p, i) => (
          <article
            key={p.personId}
            className="bg-card border border-line rounded-lg p-6 flex flex-col items-center text-center transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <Avatar
              initials={getInitials(p.name)}
              size="xl"
              color={colorForIndex(i)}
              className="mb-3"
            />
            <div className="min-w-0 w-full">
              <p className="font-display text-sm font-semibold text-ink truncate mb-0.5">
                {p.name}
              </p>
              <p className="text-[11px] text-mute truncate">{p.roleLabel}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
