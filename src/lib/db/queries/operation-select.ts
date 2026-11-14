/** Financeiro vive em `operation_financials` (RLS admin). */

export const OPERATION_DETAIL_SELECT_ADMIN = `
      id, name, product_line, status,
      response_hours, resolution_hours,
      diagnostic_id, start_date, end_date,
      created_at,
      financial:operation_financials (
        recurrence,
        monthly_recurring_revenue,
        monthly_fixed_cost,
        tax_rate_pct,
        notification_webhook_url
      ),
      client:clients!inner(id, name, slug, archived_at),
      frentes(
        id, name, cycle_type, domain, phase,
        actionable_status, actionable_status_since,
        responsible_person_id, archived_at, created_at,
        responsible:persons!fk_frentes_responsible_person_id(name),
        tasks(id, status, parent_task_id)
      )
      `;

export const OPERATION_DETAIL_SELECT_MEMBER = `
      id, name, product_line, status,
      response_hours, resolution_hours,
      diagnostic_id, start_date, end_date,
      created_at,
      client:clients!inner(id, name, slug, archived_at),
      frentes(
        id, name, cycle_type, domain, phase,
        actionable_status, actionable_status_since,
        responsible_person_id, archived_at, created_at,
        responsible:persons!fk_frentes_responsible_person_id(name),
        tasks(id, status, parent_task_id)
      )
      `;

export const OPERATION_LIST_SELECT_ADMIN = `
  id, name, client_id, product_line, status, start_date, end_date, created_at, archived_at,
  financial:operation_financials (recurrence, monthly_recurring_revenue),
  client:clients!inner(name, slug, archived_at),
  frentes(id, archived_at, phase)
`;

export const OPERATION_LIST_SELECT_MEMBER = `
  id, name, client_id, product_line, status,
  start_date, end_date, created_at, archived_at,
  client:clients!inner(name, slug, archived_at),
  frentes(id, archived_at, phase)
`;
