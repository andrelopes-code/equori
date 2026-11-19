-- +goose Up
-- The app version whose rules derived the portfolio rows: a start under another version
-- rebuilds them once, so a changed tax rule reaches the rows already derived.
CREATE TABLE portfolio_rebuild_state (
    id      boolean PRIMARY KEY DEFAULT true CHECK (id),
    version text    NOT NULL CHECK (version <> '')
);

-- +goose Down
DROP TABLE portfolio_rebuild_state;
