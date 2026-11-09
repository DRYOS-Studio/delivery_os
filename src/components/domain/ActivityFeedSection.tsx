import type { ActivityEventRow } from "@/lib/db/queries/activity";
import { buildActivityFormatContext } from "@/lib/db/queries/activity-resolve";
import { ActivityFeedClient } from "@/components/domain/ActivityFeedClient";
import type { ActivityFeedScope } from "@/lib/actions/activity-feed";
import type { ActivityFormatContext } from "@/lib/utils/activity-format";

function mapToRecord(m: Map<string, string>): Record<string, string> {
  return Object.fromEntries(m);
}

async function serializeContext(
  events: ActivityEventRow[],
): Promise<ActivityFormatContext> {
  const ctx = await buildActivityFormatContext(events);
  return {
    persons: mapToRecord(ctx.persons),
    frentes: mapToRecord(ctx.frentes),
    operations: mapToRecord(ctx.operations),
    clients: mapToRecord(ctx.clients),
    areas: mapToRecord(ctx.areas),
    profileNames: mapToRecord(ctx.profileNames),
  };
}

type Props = {
  title?: string;
  events: ActivityEventRow[];
  scope: ActivityFeedScope;
  emptyMessage?: string;
};

export async function ActivityFeedSection({
  title = "Histórico de atividade",
  events,
  scope,
  emptyMessage = "Nenhum evento registrado ainda.",
}: Props): Promise<React.JSX.Element> {
  const initialContext = await serializeContext(events);

  return (
    <ActivityFeedClient
      scope={scope}
      initialEvents={events}
      initialContext={initialContext}
      title={title}
      emptyMessage={emptyMessage}
    />
  );
}
