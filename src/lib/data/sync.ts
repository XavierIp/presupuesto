import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Huella de todo lo que el usuario ve: si cambia, la pantalla debe refrescarse.
 * Es una sola consulta de agregados (barata), pensada para consultarse cada pocos segundos.
 * Incluye lo que hacen otras personas en sus préstamos compartidos.
 */
export async function syncVersion(userId: string) {
  const { rows } = await db.execute<{ version: string; pending: number }>(sql`
    with my_loans as (
      select id, status, lender_id, borrower_id, updated_at
      from loans where lender_id = ${userId} or borrower_id = ${userId}
    )
    select
      concat_ws('|',
        (select count(*) || ':' || coalesce(max(updated_at)::text, '') from my_loans),
        (select count(*) || ':' || coalesce(max(updated_at)::text, '')
           from loan_entries where loan_id in (select id from my_loans)),
        (select count(*) || ':' || coalesce(max(updated_at)::text, '')
           from loan_payments where loan_id in (select id from my_loans)),
        (select count(*) || ':' || coalesce(max(created_at)::text, '') || ':' || coalesce(sum(amount), 0)
           from transactions where user_id = ${userId}),
        (select count(*) || ':' || coalesce(sum(opening_balance), 0)
           from financial_accounts where user_id = ${userId} and archived_at is null),
        (select count(*) || ':' || coalesce(sum(amount), 0)
           from recurring_payments where user_id = ${userId}),
        (select count(*) from recurring_payment_records r
           join recurring_payments p on p.id = r.recurring_payment_id where p.user_id = ${userId}),
        (select count(*) || ':' || coalesce(sum(amount), 0) from budgets where user_id = ${userId})
      ) as version,
      (
        (select count(*) from my_loans where borrower_id = ${userId} and status = 'pending')
        + (select count(*) from loan_entries e join my_loans l on l.id = e.loan_id
             where l.status = 'active' and e.status = 'pending' and e.requested_by <> ${userId})
        + (select count(*) from loan_payments p join my_loans l on l.id = p.loan_id
             where l.status = 'active' and p.status = 'pending' and p.created_by <> ${userId})
      )::int as pending
  `);
  return rows[0];
}
