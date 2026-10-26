-- name: CashCardLines :many
-- CV1: charge and credit postings of the user's cards in the base currency, by card and statement.
SELECT p.id, p.transaction_id, p.account_id AS card_id, p.amount, p.card_role, s.reference_month
FROM ledger_posting p
JOIN ledger_account a ON a.id = p.account_id
JOIN ledger_settings st ON st.user_id = p.user_id
JOIN ledger_statement s ON s.id = p.statement_id
WHERE p.user_id = @user_id AND NOT p.voided AND a.kind = 'credit_card' AND a.instrument = st.base_currency
  AND p.card_role IN ('charge', 'credit')
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
