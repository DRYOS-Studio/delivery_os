import { BRIEFING_SECTIONS } from "@/lib/constants/briefing";
import type { BriefingContent } from "@/lib/db/queries/briefings";

export function BriefingView({
  content,
}: {
  content: BriefingContent;
}): React.JSX.Element {
  return (
    <div className="space-y-8 max-w-3xl">
      {BRIEFING_SECTIONS.map((section) => {
        const value = content[section.key];
        return (
          <section key={section.key} className="space-y-2">
            <h2 className="font-display text-lg font-semibold text-ink">
              {section.label}
            </h2>
            {value && value.trim().length > 0 ? (
              <p className="text-sm text-ink-soft whitespace-pre-wrap leading-relaxed">
                {value}
              </p>
            ) : (
              <p className="text-sm text-mute italic">Sem conteúdo.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
