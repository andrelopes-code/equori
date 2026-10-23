-- name: DeleteIncomeEvents :exec
DELETE FROM portfolio_income_event WHERE user_id = @user_id AND account_id = ANY(@account_ids::uuid[]);

-- name: InsertIncomeEvent :exec
INSERT INTO portfolio_income_event (user_id, transaction_id, account_id, instrument, date, income_type, tax_treatment, gross, withheld, currency)
VALUES (@user_id, @transaction_id, @account_id, @instrument, @date, @income_type, @tax_treatment, @gross, @withheld, @currency);

-- name: ListIncomeEvents :many
SELECT * FROM portfolio_income_event
WHERE user_id = @user_id AND date >= @from_date AND date < @to_date
ORDER BY date, transaction_id;

-- name: ListRebuildUsers :many
SELECT user_id FROM ledger_account WHERE kind = 'brokerage'
UNION SELECT user_id FROM portfolio_position_day
UNION SELECT user_id FROM portfolio_realized_result
UNION SELECT user_id FROM portfolio_income_event
ORDER BY user_id;
