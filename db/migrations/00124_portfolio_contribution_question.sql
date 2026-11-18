-- +goose Up
-- Contribution questions CQ4: the investor's yes-or-no questions of a group and the answer of each
-- member, keyed by position as portfolio_contribution_member.
CREATE TABLE portfolio_contribution_question (
    books_id bigint  NOT NULL,
    class_id uuid    NOT NULL,
    position integer NOT NULL CHECK (position BETWEEN 0 AND 9),
    text     text    NOT NULL CHECK (char_length(text) BETWEEN 1 AND 200),
    PRIMARY KEY (class_id, position),
    FOREIGN KEY (books_id, class_id) REFERENCES portfolio_contribution_class (books_id, id) ON DELETE CASCADE
);

CREATE TABLE portfolio_contribution_answer (
    books_id          bigint  NOT NULL,
    class_id          uuid    NOT NULL,
    question_position integer NOT NULL,
    member_position   integer NOT NULL,
    yes               boolean NOT NULL,
    PRIMARY KEY (class_id, question_position, member_position),
    FOREIGN KEY (class_id, question_position) REFERENCES portfolio_contribution_question (class_id, position) ON DELETE CASCADE,
    FOREIGN KEY (class_id, member_position) REFERENCES portfolio_contribution_member (class_id, position) ON DELETE CASCADE
);

-- +goose Down
DROP TABLE portfolio_contribution_answer;
DROP TABLE portfolio_contribution_question;
