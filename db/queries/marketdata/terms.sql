-- name: GetTerms :one
SELECT * FROM marketdata_fixed_income_terms WHERE instrument_code = @instrument_code;

-- name: PutTerms :exec
INSERT INTO marketdata_fixed_income_terms (instrument_code, issued_on, matures_on, index_id, percent_of_index_bp, spread_bp, day_count, face_value)
VALUES (@instrument_code, @issued_on, @matures_on, sqlc.narg(index_id), @percent_of_index_bp, @spread_bp, @day_count, @face_value)
ON CONFLICT (instrument_code) DO UPDATE SET
    issued_on = EXCLUDED.issued_on, matures_on = EXCLUDED.matures_on, index_id = EXCLUDED.index_id,
    percent_of_index_bp = EXCLUDED.percent_of_index_bp, spread_bp = EXCLUDED.spread_bp,
    day_count = EXCLUDED.day_count, face_value = EXCLUDED.face_value;

-- name: ListTerms :many
SELECT * FROM marketdata_fixed_income_terms ORDER BY instrument_code;
