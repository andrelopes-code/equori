-- +goose Up
-- A237 H2: an institution keeps the latest quarters of a source, one row per period.
ALTER TABLE marketdata_institution_indicator
    DROP CONSTRAINT marketdata_institution_indicator_pkey;

ALTER TABLE marketdata_institution_indicator
    ADD PRIMARY KEY (scheme, identifier, period);

-- +goose Down
DELETE FROM marketdata_institution_indicator older
USING marketdata_institution_indicator newer
WHERE older.scheme = newer.scheme
    AND older.identifier = newer.identifier
    AND older.period < newer.period;

ALTER TABLE marketdata_institution_indicator
    DROP CONSTRAINT marketdata_institution_indicator_pkey;

ALTER TABLE marketdata_institution_indicator
    ADD PRIMARY KEY (scheme, identifier);
