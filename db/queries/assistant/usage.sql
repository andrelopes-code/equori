-- name: AddUsage :exec
-- One statement per attempt: the row of the day is created or its counters grow.
INSERT INTO assistant_usage (user_id, day, provider_id, model, use_id, requests, errors, quota_errors,
                             input_tokens, output_tokens, cooling_until)
VALUES (@user_id, @day, @provider_id, @model, @use_id, 1, @errors, @quota_errors, @input_tokens, @output_tokens,
        sqlc.narg(cooling_until))
ON CONFLICT (user_id, day, provider_id, model, use_id) DO UPDATE SET
    requests      = assistant_usage.requests + 1,
    errors        = assistant_usage.errors + EXCLUDED.errors,
    quota_errors  = assistant_usage.quota_errors + EXCLUDED.quota_errors,
    input_tokens  = assistant_usage.input_tokens + EXCLUDED.input_tokens,
    output_tokens = assistant_usage.output_tokens + EXCLUDED.output_tokens,
    cooling_until = GREATEST(assistant_usage.cooling_until, EXCLUDED.cooling_until);

-- name: UsageSince :many
SELECT provider_id, model,
       COALESCE(sum(requests) FILTER (WHERE day = @today::date), 0)::bigint      AS today_requests,
       COALESCE(sum(errors) FILTER (WHERE day = @today::date), 0)::bigint        AS today_errors,
       COALESCE(sum(input_tokens + output_tokens) FILTER (WHERE day = @today::date), 0)::bigint AS today_tokens,
       sum(requests)::bigint                                                      AS period_requests,
       sum(input_tokens + output_tokens)::bigint                                  AS period_tokens,
       -- Year 1 is Go's zero time: no cooldown.
       COALESCE(max(cooling_until), '0001-01-01 00:00:00+00')::timestamptz        AS cooling_until
FROM assistant_usage
WHERE user_id = @user_id AND day >= @since::date
GROUP BY provider_id, model
ORDER BY provider_id, model;

-- name: ListUsageLimits :many
SELECT * FROM assistant_usage_limit WHERE user_id = $1 ORDER BY provider_id, model;

-- name: SetUsageLimit :exec
INSERT INTO assistant_usage_limit (user_id, provider_id, model, requests_per_day, tokens_per_day)
VALUES (@user_id, @provider_id, @model, sqlc.narg(requests_per_day), sqlc.narg(tokens_per_day))
ON CONFLICT (user_id, provider_id, model) DO UPDATE SET
    requests_per_day = EXCLUDED.requests_per_day,
    tokens_per_day   = EXCLUDED.tokens_per_day;

-- name: DeleteUsageLimit :exec
DELETE FROM assistant_usage_limit WHERE user_id = $1 AND provider_id = $2 AND model = $3;

-- name: DeleteProviderUsage :exec
DELETE FROM assistant_usage WHERE user_id = $1 AND provider_id = $2;

-- name: DeleteProviderLimits :exec
DELETE FROM assistant_usage_limit WHERE user_id = $1 AND provider_id = $2;
