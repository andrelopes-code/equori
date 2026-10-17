-- name: DeleteIncomeEvents :exec
DELETE FROM portfolio_income_event WHERE user_id = @user_id AND account_id = ANY(@account_ids::uuid[]);

-- name: InsertIncomeEvent :exec
INSERT INTO portfolio_income_event (user_id, transaction_id, account_id, instrument, date, income_type, tax_treatment, gross, withheld, currency)
VALUES (@user_id, @transaction_id, @account_id, @instrument, @date, @income_type, @tax_treatment, @gross, @withheld, @currency);

-- name: ListIncomeEvents :many
SELECT * FROM portfolio_income_event
WHERE user_id = @user_id AND date >= @from_date AND date < @to_date
ORDER BY date, transaction_id;
