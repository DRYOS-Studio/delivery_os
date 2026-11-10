export function operationCostEditPath(
  operationId: string,
  costId: string,
): string {
  return `/operations/${operationId}/costs/${costId}/edit`;
}
