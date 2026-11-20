-- +goose Up
-- Answer views design V19: an undo is a proposal that runs the inverse of an executed proposal;
-- at most one undo of a proposal is pending, executing or executed.
ALTER TABLE assistant_proposal
    ADD COLUMN undoes uuid REFERENCES assistant_proposal (id) ON DELETE CASCADE;
CREATE UNIQUE INDEX assistant_proposal_undoes ON assistant_proposal (undoes)
    WHERE undoes IS NOT NULL AND status IN ('pending', 'executing', 'executed');

-- +goose Down
DROP INDEX assistant_proposal_undoes;
ALTER TABLE assistant_proposal DROP COLUMN undoes;
