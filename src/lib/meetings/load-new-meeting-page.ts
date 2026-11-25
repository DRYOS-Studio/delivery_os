import type { AttendeeRef } from "@/lib/db/queries/meetings";
import { listAttendeeCandidates } from "@/lib/db/queries/meetings";
import { listActiveFrentesByOperation } from "@/lib/db/queries/frentes";
import {
  getOperationMeetingContext,
  type OperationMeetingContext,
} from "@/lib/db/queries/operation-meeting-context";

export type NewMeetingPageData = {
  operation: OperationMeetingContext;
  attendeeCandidates: AttendeeRef[];
  frentes: { id: string; name: string }[];
};

/** Dados da rota `/operations/[id]/meetings/new` (create + onboarding). */
export async function loadNewMeetingPageData(
  operationId: string,
): Promise<NewMeetingPageData | null> {
  const operation = await getOperationMeetingContext(operationId);
  if (!operation) return null;

  const [attendeeCandidates, frentes] = await Promise.all([
    listAttendeeCandidates(operation.client.id),
    listActiveFrentesByOperation(operationId),
  ]);

  return { operation, attendeeCandidates, frentes };
}
