-- name: CashCardLines :many
-- Charge and credit postings of the user's cards by card and statement; base marks a card in
-- the base currency (CV1, CV6). A line of an installment plan carries the date of its purchase.
SELECT p.id, p.transaction_id, p.account_id AS card_id, p.amount, p.card_role, s.reference_month,
       (a.instrument = st.base_currency)::boolean AS base, o.date AS plan_purchase_date,
       EXISTS (SELECT 1 FROM ledger_link l WHERE l.user_id = p.user_id AND l.from_transaction_id = p.transaction_id
               AND l.link_type = 'anticipation_of')::boolean AS anticipation
FROM ledger_posting p
JOIN ledger_account a ON a.id = p.account_id
JOIN ledger_settings st ON st.user_id = p.user_id
JOIN ledger_statement s ON s.id = p.statement_id
LEFT JOIN ledger_installment_plan ip ON ip.id = p.installment_plan_id
LEFT JOIN ledger_transaction o ON o.id = ip.origin_transaction_id
WHERE p.user_id = @user_id AND NOT p.voided AND a.kind = 'credit_card' AND p.card_role IN ('charge', 'credit')
ORDER BY p.account_id, s.reference_month, p.id;

-- name: CashPayments :many
-- CV4: payments of the user's cards in the base currency up to a date, in the order they apply.
SELECT p.id, p.account_id AS card_id, p.booked_on, p.amount
FROM ledger_posting p
JOIN ledger_account a ON a.id = p.account_id
JOIN ledger_settings st ON st.user_id = p.user_id
WHERE p.user_id = @user_id AND NOT p.voided AND a.kind = 'credit_card' AND a.instrument = st.base_currency
  AND p.card_role = 'payment' AND p.booked_on <= @to_date::date
ORDER BY p.account_id, p.booked_on, p.id;

-- name: CashCategoryPostings :many
SELECT p.transaction_id, p.account_id, p.amount
FROM ledger_posting p
JOIN ledger_account a ON a.id = p.account_id
WHERE p.user_id = @user_id AND NOT p.voided AND a.account_class IN ('expense', 'income')
  AND p.transaction_id = ANY (@transaction_ids::uuid[])
ORDER BY p.transaction_id, p.account_id;

-- name: CashOrigins :many
-- CV2: the purchase whose plan a transaction anticipates or cancels.
SELECT from_transaction_id, to_transaction_id
FROM ledger_link
WHERE user_id = @user_id AND link_type IN ('anticipation_of', 'cancellation_of')
  AND from_transaction_id = ANY (@transaction_ids::uuid[]);

-- name: CashOffCardTotals :many
-- CV1: category postings in [from, to] of transactions without a card line, per category.
SELECT p.account_id, sum(p.amount)::bigint AS total
FROM ledger_posting p
JOIN ledger_account a ON a.id = p.account_id
WHERE p.user_id = @user_id AND NOT p.voided AND a.account_class IN ('expense', 'income')
  AND p.booked_on BETWEEN @from_date::date AND @to_date::date
  AND NOT EXISTS (
    SELECT 1 FROM ledger_posting q
    JOIN ledger_account qa ON qa.id = q.account_id
    JOIN ledger_settings st ON st.user_id = q.user_id
    WHERE q.transaction_id = p.transaction_id AND q.user_id = p.user_id AND NOT q.voided
      AND qa.kind = 'credit_card' AND qa.instrument = st.base_currency AND q.card_role IN ('charge', 'credit'))
GROUP BY p.account_id;

-- name: AnalyticsStatements :many
-- The card's statements with the closing of the one before each, newest first.
SELECT s.id, s.account_id, s.reference_month, s.closing_date, a.instrument,
       coalesce(lag(s.closing_date) OVER (ORDER BY s.reference_month), '1900-01-01')::date AS previous_closing
FROM ledger_statement s
JOIN ledger_account a ON a.id = s.account_id
WHERE s.user_id = @user_id AND s.account_id = @card_id AND a.kind = 'credit_card'
ORDER BY s.reference_month DESC;

-- name: StatementCard :one
SELECT s.account_id FROM ledger_statement s WHERE s.user_id = @user_id AND s.id = @id;

-- name: ChargeCategories :many
-- The system categories interest, taxes and fees with their descendants.
WITH RECURSIVE c AS (
    SELECT r.id FROM ledger_account r WHERE r.user_id = @user_id AND r.system_role IN ('interest', 'taxes', 'fees')
    UNION ALL
    SELECT a.id FROM ledger_account a JOIN c ON a.parent_id = c.id WHERE a.user_id = @user_id
)
SELECT id FROM c;

-- name: CardInstrument :one
SELECT instrument FROM ledger_account WHERE user_id = @user_id AND id = @id AND kind = 'credit_card';
