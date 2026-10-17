-- name: InsertTrade :exec
INSERT INTO ledger_trade (transaction_id, user_id, account_id, cash_account_id, side, quantity, unit_price, gross, fees, taxes, cost, currency)
VALUES (@transaction_id, @user_id, @account_id, @cash_account_id, @side, @quantity, @unit_price, @gross, @fees, @taxes, sqlc.narg(cost), @currency);

-- name: ListTrades :many
SELECT * FROM ledger_trade WHERE user_id = @user_id AND transaction_id = ANY(@transaction_ids::uuid[]);

-- name: Holding :one
-- The quantity and cost basis of a security account at the end of a date (P8 amendment A68).
SELECT coalesce(sum(amount), 0)::bigint AS quantity, coalesce(sum(weight), 0)::bigint AS cost_basis
FROM ledger_posting
WHERE user_id = @user_id AND account_id = @account_id AND NOT voided AND booked_on <= @on_date;

-- name: LaterSaleExists :one
-- P8 amendment A69: a non-voided sale of one of the accounts dated on or after on_date.
SELECT EXISTS (
    SELECT 1 FROM ledger_trade tr
    JOIN ledger_transaction t ON t.user_id = tr.user_id AND t.id = tr.transaction_id
    WHERE tr.user_id = @user_id AND tr.account_id = ANY(@account_ids::uuid[]) AND tr.side = 'sell'
      AND t.voided_at IS NULL AND t.date >= @on_date AND tr.transaction_id <> @exclude
);

