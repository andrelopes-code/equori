-- name: DeleteIndexExpectations :exec
DELETE FROM marketdata_index_expectation WHERE index_id = @index_id;

-- name: InsertIndexExpectation :exec
INSERT INTO marketdata_index_expectation (index_id, date, rate, survey_date, source)
VALUES (@index_id, @date, @rate, @survey_date, @source);

-- name: ListIndexExpectations :many
SELECT date, rate, survey_date FROM marketdata_index_expectation WHERE index_id = @index_id ORDER BY date;

-- name: LatestSurvey :one
-- found is false, and latest meaningless, when the source stored no expectation.
SELECT coalesce(max(survey_date), DATE '0001-01-01')::date AS latest, (count(*) > 0)::boolean AS found
FROM marketdata_index_expectation WHERE source = @source;
