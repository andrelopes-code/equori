-- name: DeleteRealizedResults :exec
DELETE FROM portfolio_realized_result WHERE user_id = @user_id AND account_id = ANY(@account_ids::uuid[]);

-- name: InsertRealizedResult :exec
INSERT INTO portfolio_realized_result (user_id, transaction_id, account_id, instrument, date, month, quantity, cost, proceeds, result, tax_class, currency)
VALUES (@user_id, @transaction_id, @account_id, @instrument, @date, @month, @quantity, @cost, @proceeds, @result, @tax_class, @currency);

-- name: ListRealizedResults :many
SELECT * FROM portfolio_realized_result
WHERE user_id = @user_id AND date >= @from_date AND date < @to_date
ORDER BY date, transaction_id;
