import type { AttendeeRef } from "@/lib/db/queries/meetings";
import { listAttendeeCandidates } from "@/lib/db/queries/meetings";
import { listActiveFrentesByOperation } from "@/lib/db/queries/frentes";
import {
  getOperation,
  type OperationDetail,
} from "@/lib/db/queries/operations";

export type NewMeetingPageData = {
  operation: OperationDetail;
  attendeeCandidates: AttendeeRef[];
  frentes: { id: string; name: string }[];
};

/** Dados da rota `/operations/[id]/meetings/new` (create + onboarding). */
export async function loadNewMeetingPageData(
  operationId: string,
): Promise<NewMeetingPageData | null> {
  const operation = await getOperation(operationId);
  if (!operation) return null;

  const [attendeeCandidates, frentes] = await Promise.all([
    listAttendeeCandidates(operation.client.id),
    listActiveFrentesByOperation(operationId),
  ]);

  return { operation, attendeeCandidates, frentes };
}
