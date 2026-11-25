-- name: UpsertSentiment :exec
INSERT INTO
    marketdata_sentiment (index_id, date, value, source)
VALUES
    (@index_id, @date, @value, @source)
ON CONFLICT (index_id, date) DO UPDATE
SET
    value = excluded.value,
    source = excluded.source
WHERE
    marketdata_sentiment.value <> excluded.value
    OR marketdata_sentiment.source <> excluded.source;

-- name: LatestSentiment :many
-- The newest value of the index, no row without one.
SELECT
    date,
    value
FROM
    marketdata_sentiment
WHERE
    index_id = @index_id
ORDER BY
    date DESC
LIMIT
    1;

-- name: CountSentiment :many
-- The days each value of the index was published on.
SELECT
    value,
    count(*)::bigint AS days,
    min(date)::date AS first
FROM
    marketdata_sentiment
WHERE
    index_id = @index_id
GROUP BY
    value
ORDER BY
    value;
