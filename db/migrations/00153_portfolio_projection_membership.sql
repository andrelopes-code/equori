-- +goose Up
-- ADR 029: a business table never references the person; the plan follows the membership, as
-- assistant_conversation does, so leaving a book removes the plan of that book.
ALTER TABLE portfolio_projection_plan
    DROP CONSTRAINT portfolio_projection_plan_member_id_fkey,
    ADD CONSTRAINT portfolio_projection_plan_membership_fkey FOREIGN KEY (member_id, books_id)
        REFERENCES identity_membership (member_id, books_id) ON DELETE CASCADE;

-- +goose Down
ALTER TABLE portfolio_projection_plan
    DROP CONSTRAINT portfolio_projection_plan_membership_fkey,
    ADD CONSTRAINT portfolio_projection_plan_member_id_fkey FOREIGN KEY (member_id)
        REFERENCES identity_member (id) ON DELETE CASCADE;
