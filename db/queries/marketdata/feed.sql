-- name: ListFeeds :many
SELECT id, enabled FROM marketdata_feed ORDER BY id;

-- name: SetFeed :exec
INSERT INTO marketdata_feed (id, enabled) VALUES (@id, @enabled)
ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled;
