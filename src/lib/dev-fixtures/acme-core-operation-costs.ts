import type { OperationCostBreakdown } from "@/lib/db/queries/operation-costs";
import type { OperationDetail } from "@/lib/db/queries/operations";

/** Espelha exemplo Rafael: MRR 3000, imposto 6%, comissão 10% → R$ 282/mês. */
export const ACME_CORE_OPERATION_ID =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const today = new Date().toISOString().slice(0, 10);

export const acmeCoreCostsBreakdown: OperationCostBreakdown = {
  fixedCost: 1682,
  categorySubtotals: {
    comissoes: 282,
    infra: 200,
    time: 1200,
  },
  adHocMonthly: 1682,
  adHocOnceTotal: 0,
  adHocItems: [
    {
      id: "99999999-9999-4999-8999-999999999999",
      operationId: ACME_CORE_OPERATION_ID,
      label: "Comissão parceiro",
      amount: null,
      commissionPercent: 10,
      monthlyAmount: 282,
      category: "comissoes",
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
      amount: 200,
      commissionPercent: null,
      monthlyAmount: 200,
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
      amount: 1200,
      commissionPercent: null,
      monthlyAmount: 1200,
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
  taxRatePct: 6,
  taxMonthlyAmount: 180,
  totalMonthly: 3782,
  chargedRevenue: 3000,
};

export const acmeCoreOperationEditFixture: OperationDetail = {
  id: ACME_CORE_OPERATION_ID,
  name: "Acme Core",
  productLine: "core",
  status: "em_operacao",
  recurrence: "mensal",
  monthlyRecurringRevenue: 3000,
  monthlyFixedCost: 1200,
  taxRatePct: 6,
  responseHours: null,
  resolutionHours: null,
  diagnosticId: null,
  startDate: today,
  endDate: null,
  notificationWebhookUrl: null,
  createdAt: today,
  client: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Acme",
    slug: "acme",
  },
  frentes: [],
};
