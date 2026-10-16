-- name: ListInstallmentPlans :many
SELECT plan_key, plan_id FROM ingestion_installment_plan WHERE user_id = @user_id AND plan_key = ANY(@keys::bytea[]);

-- name: SaveInstallmentPlan :exec
INSERT INTO ingestion_installment_plan (user_id, account_id, plan_key, plan_id)
VALUES (@user_id, @account_id, @plan_key, @plan_id)
ON CONFLICT (user_id, plan_key) DO NOTHING;
