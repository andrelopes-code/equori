-- name: InsertBillingRule :one
INSERT INTO ledger_billing_cycle_rule (
    user_id, account_id, effective_from, closing_day, due_day, closing_day_assignment, due_date_adjustment, calendar,
    closing_mode, closing_days_before_due, closing_adjustment
) VALUES (@user_id, @account_id, @effective_from, sqlc.narg(closing_day), @due_day, @closing_day_assignment, @due_date_adjustment, @calendar,
    @closing_mode, sqlc.narg(closing_days_before_due), @closing_adjustment)
RETURNING *;

-- name: ListBillingRules :many
SELECT * FROM ledger_billing_cycle_rule WHERE user_id = $1 AND account_id = $2 ORDER BY effective_from;

-- name: InsertCreditLimit :one
INSERT INTO ledger_credit_limit (user_id, account_id, effective_from, amount) VALUES ($1, $2, $3, $4)
ON CONFLICT (account_id, effective_from) DO UPDATE SET amount = EXCLUDED.amount
WHERE ledger_credit_limit.user_id = EXCLUDED.user_id
RETURNING *;

-- name: ListCreditLimits :many
SELECT * FROM ledger_credit_limit WHERE user_id = $1 AND account_id = $2 ORDER BY effective_from;

-- name: InsertCard :one
INSERT INTO ledger_card (user_id, account_id, holder, last_four, virtual, foreign_charge_bp) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;

-- name: ListCards :many
SELECT * FROM ledger_card WHERE user_id = $1 AND account_id = $2 ORDER BY created_at, id;

-- name: SetCardActive :one
UPDATE ledger_card SET active = @active WHERE user_id = @user_id AND id = @id RETURNING *;

-- name: EnsureStatement :one
WITH inserted AS (
    INSERT INTO ledger_statement (user_id, account_id, reference_month, closing_date, due_date)
    VALUES (@user_id, @account_id, @reference_month, @closing_date, @due_date)
    ON CONFLICT (account_id, reference_month) DO NOTHING
    RETURNING id
)
SELECT id FROM inserted
UNION ALL
SELECT id FROM ledger_statement WHERE account_id = @account_id AND reference_month = @reference_month
LIMIT 1;

-- name: ListStatements :many
SELECT s.*, EXISTS (SELECT 1 FROM ledger_reconciliation r WHERE r.statement_id = s.id) AS reconciled
FROM ledger_statement s
WHERE s.user_id = $1 AND s.account_id = $2
ORDER BY s.reference_month;

-- name: ListStatementLines :many
SELECT p.statement_id, p.card_role, p.amount, p.booked_on
FROM ledger_posting p
WHERE p.user_id = $1 AND p.account_id = $2 AND NOT p.voided AND p.statement_id IS NOT NULL;

-- name: GetStatement :one
SELECT * FROM ledger_statement WHERE user_id = $1 AND id = $2;

-- name: ListStatementPostings :many
SELECT p.transaction_id, t.date, t.description, p.card_role, p.amount,
       p.installment_plan_id, p.installment_number, p.installment_count
FROM ledger_posting p
JOIN ledger_transaction t ON t.id = p.transaction_id
WHERE p.user_id = $1 AND p.statement_id = $2 AND NOT p.voided
ORDER BY t.date, t.id, p.position;

-- name: InsertInstallmentPlan :exec
INSERT INTO ledger_installment_plan (
    id, user_id, account_id, origin_transaction_id, plan_kind, installment_count, principal, interest, first_statement_id
) VALUES (@id, @user_id, @account_id, @origin_transaction_id, @plan_kind, @installment_count, @principal, @interest, @first_statement_id);

-- name: GetSystemAccount :one
SELECT * FROM ledger_account WHERE user_id = $1 AND system_role = $2;

-- name: ListOpenStatementsFrom :many
SELECT * FROM ledger_statement
WHERE user_id = @user_id AND account_id = @account_id AND reference_month >= @from_month AND closing_date > @today
ORDER BY reference_month;

-- name: UpdateStatementDates :exec
UPDATE ledger_statement SET closing_date = @closing_date, due_date = @due_date WHERE id = @id;

-- name: CommittedInstallments :one
SELECT coalesce(-sum(p.amount), 0)::bigint
FROM ledger_posting p
JOIN ledger_statement s ON s.id = p.statement_id
WHERE p.user_id = @user_id AND p.account_id = @account_id AND NOT p.voided
  AND p.installment_plan_id IS NOT NULL AND p.card_role = 'charge'
  AND s.reference_month = @reference_month AND s.closing_date > @today;

-- name: PriorInstallments :one
-- Budget plan amendment A129: installments billed on statement M of purchases booked before M,
-- which the accrual view counted in an earlier month.
SELECT coalesce(-sum(p.amount), 0)::bigint
FROM ledger_posting p
JOIN ledger_statement s ON s.id = p.statement_id
WHERE p.user_id = @user_id AND p.account_id = @account_id AND NOT p.voided
  AND p.installment_plan_id IS NOT NULL AND p.card_role = 'charge'
  AND s.reference_month = @reference_month AND p.booked_on < @reference_month;

-- name: SetStatementFinanced :exec
UPDATE ledger_statement SET financed_by_plan_id = @plan_id WHERE id = @id;

-- name: GetPlan :one
SELECT * FROM ledger_installment_plan WHERE user_id = $1 AND id = $2;

-- name: ListPlanInstallments :many
SELECT p.installment_number, p.amount, s.reference_month, s.closing_date
FROM ledger_posting p
JOIN ledger_statement s ON s.user_id = p.user_id AND s.id = p.statement_id
WHERE p.user_id = $1 AND p.installment_plan_id = $2 AND NOT p.voided AND p.card_role = 'charge'
ORDER BY p.installment_number;

-- name: PlanState :one
SELECT
  EXISTS (SELECT 1 FROM ledger_link l JOIN ledger_transaction t ON t.user_id = l.user_id AND t.id = l.from_transaction_id
          WHERE l.user_id = @user_id AND l.to_transaction_id = @origin_id
            AND l.link_type = 'cancellation_of' AND t.voided_at IS NULL) AS cancelled,
  EXISTS (SELECT 1 FROM ledger_link l JOIN ledger_transaction t ON t.user_id = l.user_id AND t.id = l.from_transaction_id
          WHERE l.user_id = @user_id AND l.to_transaction_id = @origin_id
            AND l.link_type = 'anticipation_of' AND t.voided_at IS NULL) AS anticipated;

-- name: AnticipatedReferences :many
SELECT DISTINCT s.reference_month
FROM ledger_link l
JOIN ledger_transaction t ON t.user_id = l.user_id AND t.id = l.from_transaction_id AND t.voided_at IS NULL
JOIN ledger_posting p ON p.user_id = l.user_id AND p.transaction_id = t.id AND p.card_role = 'credit' AND NOT p.voided
JOIN ledger_statement s ON s.user_id = l.user_id AND s.id = p.statement_id
WHERE l.user_id = @user_id AND l.to_transaction_id = @origin_id AND l.link_type = 'anticipation_of';

-- name: ListAnticipationCharges :many
-- A135: what non-voided anticipations of the origin purchase charged, by statement.
SELECT p.amount, s.reference_month, s.closing_date
FROM ledger_link l
JOIN ledger_transaction t ON t.user_id = l.user_id AND t.id = l.from_transaction_id AND t.voided_at IS NULL
JOIN ledger_posting p ON p.user_id = l.user_id AND p.transaction_id = t.id AND p.card_role = 'charge' AND NOT p.voided
JOIN ledger_statement s ON s.user_id = l.user_id AND s.id = p.statement_id
WHERE l.user_id = @user_id AND l.to_transaction_id = @origin_id AND l.link_type = 'anticipation_of'
ORDER BY s.reference_month, p.id;

-- name: AnticipationDiscount :one
-- A135: the discount non-voided anticipations of the origin purchase granted, positive.
SELECT coalesce(-sum(p.amount), 0)::bigint
FROM ledger_link l
JOIN ledger_transaction t ON t.user_id = l.user_id AND t.id = l.from_transaction_id AND t.voided_at IS NULL
JOIN ledger_posting p ON p.user_id = l.user_id AND p.transaction_id = t.id AND NOT p.voided
JOIN ledger_account a ON a.user_id = l.user_id AND a.id = p.account_id AND a.system_role = 'discounts'
WHERE l.user_id = @user_id AND l.to_transaction_id = @origin_id AND l.link_type = 'anticipation_of';

-- name: RefundedTotal :one
SELECT coalesce(sum(p.amount), 0)::bigint
FROM ledger_link l
JOIN ledger_posting p ON p.user_id = l.user_id AND p.transaction_id = l.from_transaction_id
WHERE l.user_id = $1 AND l.to_transaction_id = $2 AND l.link_type IN ('refund_of', 'cancellation_of', 'chargeback_of')
  AND p.card_role = 'credit' AND NOT p.voided;

-- name: InsertDispute :one
INSERT INTO ledger_dispute (user_id, transaction_id, opened_on) VALUES ($1, $2, $3) RETURNING *;

-- name: ListDisputes :many
SELECT * FROM ledger_dispute WHERE user_id = $1 AND transaction_id = $2 ORDER BY opened_on, id;

-- name: GetDisputeForUpdate :one
SELECT * FROM ledger_dispute WHERE user_id = $1 AND id = $2 FOR UPDATE;

-- name: ResolveDispute :one
UPDATE ledger_dispute SET resolved_on = @resolved_on, outcome = @outcome, refund_transaction_id = sqlc.narg(refund_transaction_id)
WHERE id = @id
RETURNING *;

-- name: GetStatementByDueDate :one
SELECT reference_month FROM ledger_statement WHERE user_id = @user_id AND account_id = @account_id AND due_date = @due_date;

-- name: LockPlanInstallment :one
-- P6 A40: installment k of a plan and whether the purchase was voided, refunded or cancelled.
SELECT p.id, p.amount, p.external_record_id, p.transaction_id,
    (t.voided_at IS NOT NULL OR EXISTS (
        SELECT 1 FROM ledger_link l WHERE l.user_id = t.user_id AND l.to_transaction_id = t.id
          AND l.link_type IN ('refund_of', 'cancellation_of'))) AS reversed
FROM ledger_installment_plan pl
JOIN ledger_posting p ON p.installment_plan_id = pl.id AND p.installment_number = @number AND p.card_role = 'charge'
JOIN ledger_transaction t ON t.id = p.transaction_id
WHERE pl.user_id = @user_id AND pl.id = @plan_id
FOR UPDATE OF p;
