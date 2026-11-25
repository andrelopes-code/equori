-- +goose Up
-- Contribution conditions CO1, CO3, CO7, CO8, CO15.
ALTER TABLE portfolio_contribution_plan
    ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0);

ALTER TABLE portfolio_contribution_question
    ADD COLUMN effect text NOT NULL DEFAULT 'weigh' CHECK (effect IN ('warn', 'hold', 'weigh')),
    ADD COLUMN review_months smallint NOT NULL DEFAULT 0 CHECK (review_months IN (0, 1, 3, 6, 12));

ALTER TABLE portfolio_contribution_answer
    ADD COLUMN answered_on date,
    ADD COLUMN overrides boolean NOT NULL DEFAULT FALSE;

ALTER TABLE portfolio_contribution_member
    ADD COLUMN release_month date CHECK (extract(DAY FROM release_month) = 1);

-- +goose Down
ALTER TABLE portfolio_contribution_member
    DROP COLUMN release_month;

ALTER TABLE portfolio_contribution_answer
    DROP COLUMN answered_on,
    DROP COLUMN overrides;

ALTER TABLE portfolio_contribution_question
    DROP COLUMN effect,
    DROP COLUMN review_months;

ALTER TABLE portfolio_contribution_plan
    DROP COLUMN revision;
