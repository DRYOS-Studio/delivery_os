import type { OperationCostBreakdown } from "@/lib/db/queries/operation-costs";
import type { OperationDetail } from "@/lib/db/queries/operations";

/** Espelha supabase/seed/dev_demo.sql (Acme Core) após migration 20261109250000. */
export const ACME_CORE_OPERATION_ID =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const today = new Date().toISOString().slice(0, 10);

export const acmeCoreCostsBreakdown: OperationCostBreakdown = {
  fixedCost: 4350,
  categorySubtotals: {
    a_classificar: 1200,
    infra: 350,
    time: 2800,
  },
  adHocMonthly: 4350,
  adHocOnceTotal: 0,
  adHocItems: [
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      operationId: ACME_CORE_OPERATION_ID,
      label: "Custo migrado do campo único",
      amount: 1200,
      category: "a_classificar",
      recurrence: "mensal",
      startedAt: today,
      endedAt: null,
      notes: null,
      createdAt: today,
      updatedAt: today,
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      operationId: ACME_CORE_OPERATION_ID,
      label: "Ferramentas de observabilidade",
      amount: 350,
      category: "infra",
      recurrence: "mensal",
      startedAt: today,
      endedAt: null,
      notes: "Datadog + logs",
      createdAt: today,
      updatedAt: today,
    },
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      operationId: ACME_CORE_OPERATION_ID,
      label: "Squads de entrega",
      amount: 2800,
      category: "time",
      recurrence: "mensal",
      startedAt: today,
      endedAt: null,
      notes: null,
      createdAt: today,
      updatedAt: today,
    },
  ],
  allocations: [
    {
      allocationId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      personId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      personName: "Rafael",
      capacityPct: 40,
      weeklyHours: null,
      effectiveWeeklyHours: 16,
      hourlyRate: 120,
      fixedMonthlyCost: null,
      monthlyCost: 1920,
    },
  ],
  allocationsTotal: 1920,
  taxRatePct: null,
  taxMonthlyAmount: 0,
  totalMonthly: 6270,
};

export const acmeCoreOperationEditFixture: OperationDetail = {
  id: ACME_CORE_OPERATION_ID,
  name: "Acme Core",
  productLine: "core",
  status: "em_operacao",
  recurrence: "mensal",
  monthlyRecurringRevenue: 8500,
  monthlyFixedCost: 1200,
  taxRatePct: null,
  responseHours: null,
  resolutionHours: null,
  diagnosticId: null,
  startDate: today,
  endDate: null,
  notificationWebhookUrl: null,
  createdAt: today,
  client: { id: "11111111-1111-4111-8111-111111111111", name: "Acme", slug: "acme" },
  frentes: [],
};
