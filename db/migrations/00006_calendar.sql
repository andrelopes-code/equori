-- +goose Up
-- Instance-defined non-business days added to a calendar's computed rules (T06).
CREATE TABLE marketdata_holiday (
    calendar text NOT NULL CHECK (calendar ~ '^[a-z0-9_]{2,40}$'),
    date     date NOT NULL,
    name     text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    PRIMARY KEY (calendar, date)
);

-- +goose Down
DROP TABLE marketdata_holiday;
