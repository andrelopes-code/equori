-- +goose Up
ALTER TABLE assistant_proposal
    ADD COLUMN suggested boolean NOT NULL DEFAULT false,
    ADD COLUMN reason    text CHECK (char_length(reason) <= 200),
    ADD COLUMN summary   text CHECK (char_length(summary) <= 200),
    ADD COLUMN refs      jsonb CHECK (jsonb_typeof(refs) = 'object');

ALTER TABLE assistant_proposal DROP CONSTRAINT assistant_proposal_basis_check;
ALTER TABLE assistant_proposal ADD CONSTRAINT assistant_proposal_basis_check
    CHECK (basis ~ '^[0-9a-f]{64}$' OR (basis = '' AND refs IS NOT NULL));

ALTER TABLE assistant_proposal DROP CONSTRAINT assistant_proposal_status_check;
ALTER TABLE assistant_proposal ADD CONSTRAINT assistant_proposal_status_check
    CHECK (status IN ('pending', 'executing', 'executed', 'failed', 'rejected', 'stale', 'discarded', 'waiting', 'blocked'));

ALTER TABLE assistant_proposal DROP CONSTRAINT assistant_proposal_check1;
ALTER TABLE assistant_proposal ADD CONSTRAINT assistant_proposal_check1
    CHECK ((status IN ('pending', 'executing', 'waiting')) = (decided_at IS NULL));

-- +goose Down
DELETE FROM assistant_proposal WHERE status IN ('waiting', 'blocked') OR basis = '';

ALTER TABLE assistant_proposal DROP CONSTRAINT assistant_proposal_check1;
ALTER TABLE assistant_proposal ADD CONSTRAINT assistant_proposal_check1
    CHECK ((status IN ('pending', 'executing')) = (decided_at IS NULL));

ALTER TABLE assistant_proposal DROP CONSTRAINT assistant_proposal_status_check;
ALTER TABLE assistant_proposal ADD CONSTRAINT assistant_proposal_status_check
    CHECK (status IN ('pending', 'executing', 'executed', 'failed', 'rejected', 'stale', 'discarded'));

ALTER TABLE assistant_proposal DROP CONSTRAINT assistant_proposal_basis_check;
ALTER TABLE assistant_proposal ADD CONSTRAINT assistant_proposal_basis_check
    CHECK (basis ~ '^[0-9a-f]{64}$');

ALTER TABLE assistant_proposal
    DROP COLUMN refs,
    DROP COLUMN summary,
    DROP COLUMN reason,
    DROP COLUMN suggested;
