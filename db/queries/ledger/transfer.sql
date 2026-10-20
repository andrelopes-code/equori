-- name: PairingCandidates :many
-- P5b amendment A29: uncategorized imported transactions with the opposite side on the account;
-- a card payment waiting on transfers_in_transit is one too (A88).
SELECT t.id FROM ledger_transaction t
WHERE t.user_id = @user_id AND t.id <> @transaction_id AND t.voided_at IS NULL AND t.origin = 'import'
  AND t.date BETWEEN @from_date::date AND @to_date::date
  AND EXISTS (SELECT 1 FROM ledger_posting p WHERE p.transaction_id = t.id AND p.account_id = @account_id AND p.amount = @amount)
  AND NOT EXISTS (SELECT 1 FROM ledger_posting p WHERE p.transaction_id = t.id AND p.account_id = ANY(@excluded_accounts::uuid[]))
  AND EXISTS (SELECT 1 FROM ledger_posting p JOIN ledger_account a ON a.id = p.account_id
              WHERE p.transaction_id = t.id AND a.system_role IN ('uncategorized_expense', 'uncategorized_income', 'transfers_in_transit'))
  AND NOT EXISTS (SELECT 1 FROM ledger_posting p JOIN ledger_account a ON a.id = p.account_id
              WHERE p.transaction_id = t.id AND a.account_class IN ('income', 'expense')
                AND a.system_role IS DISTINCT FROM 'uncategorized_expense' AND a.system_role IS DISTINCT FROM 'uncategorized_income')
ORDER BY t.date, t.id;

-- name: ClearRecordLinks :exec
UPDATE ledger_posting SET external_record_id = NULL WHERE user_id = $1 AND transaction_id = $2;
