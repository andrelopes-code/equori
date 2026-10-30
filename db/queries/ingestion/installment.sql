-- name: ListInstallmentPlans :many
SELECT
    plan_key,
    plan_id
FROM
    ingestion_installment_plan
WHERE
    books_id = @books_id
    AND plan_key = ANY (@keys::bytea[]);

-- name: SaveInstallmentPlan :exec
INSERT INTO
    ingestion_installment_plan (books_id, account_id, plan_key, plan_id)
VALUES
    (@books_id, @account_id, @plan_key, @plan_id)
ON CONFLICT (books_id, plan_key) DO NOTHING;
