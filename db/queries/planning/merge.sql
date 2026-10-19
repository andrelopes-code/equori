-- A75: planning references follow a category merge.

-- name: DeleteMergedBudget :exec
-- When the destination has a budget, the source budget and its amounts go.
DELETE FROM planning_budget b
WHERE b.user_id = @user_id AND b.category_account_id = @from_id
  AND EXISTS (SELECT 1 FROM planning_budget o WHERE o.user_id = @user_id AND o.category_account_id = @into_id);

-- name: MoveMergedBudget :exec
UPDATE planning_budget SET category_account_id = @into_id
WHERE user_id = @user_id AND category_account_id = @from_id;

-- name: MergeScheduleAccounts :exec
UPDATE planning_schedule
SET account_id = CASE WHEN account_id = @from_id THEN @into_id ELSE account_id END,
    counterpart_id = CASE WHEN counterpart_id = @from_id THEN @into_id ELSE counterpart_id END,
    updated_at = now()
WHERE user_id = @user_id AND (account_id = @from_id OR counterpart_id = @from_id);

-- name: MergeSchedulePayee :exec
-- A82: schedules follow a payee merge.
UPDATE planning_schedule SET payee_id = @into_id, updated_at = now()
WHERE user_id = @user_id AND payee_id = @from_id;
