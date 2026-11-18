-- +goose Up
-- Coverage row E-06 (assistant parity design, phase 6): a right issue gives units of a
-- subscription right beside the holding at no cost, and a right exercise turns them into the
-- subscribed security. Both name the holding of that security in new_account_id.
ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_kind_check;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_kind_check
    CHECK (kind IN (
        'split', 'reverse_split', 'bonus', 'unit_tax', 'conversion', 'spin_off', 'right_issue',
        'right_exercise'
    ));

ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_ratio;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_ratio
    CHECK (kind IN ('conversion', 'spin_off', 'right_issue', 'right_exercise')
        OR (kind = 'reverse_split') = (ratio_to < ratio_from));

ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_exchange;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_exchange
    CHECK ((kind IN ('conversion', 'spin_off', 'right_issue', 'right_exercise'))
            = (new_account_id IS NOT NULL)
        AND (kind = 'spin_off') = (cost_bp IS NOT NULL));

-- value is the subscription price a right exercise paid, always above zero.
ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_value;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_value
    CHECK (kind IN ('bonus', 'unit_tax')
        OR (unit_cost IS NULL AND (value > 0) = (kind = 'right_exercise') AND value >= 0));

-- A right received at no cost is a posting of units with weight zero (IN RFB 1.585/2015, art. 58;
-- owner decision 2026-11-18), and so is each later outflow of those units. The domain allows a
-- zero weight on the inflow of a right issue and on an outflow, which takes the cost it finds.
ALTER TABLE ledger_posting DROP CONSTRAINT ledger_posting_weight_check;
ALTER TABLE ledger_posting ADD CONSTRAINT ledger_posting_weight_check
    CHECK (abs(weight) <= 9007199254740991);

-- The sale of a right received at no cost takes no cost out of the holding.
ALTER TABLE ledger_trade DROP CONSTRAINT ledger_trade_cost_check;
ALTER TABLE ledger_trade ADD CONSTRAINT ledger_trade_cost_check CHECK (cost >= 0);

-- +goose Down
CREATE TEMPORARY TABLE right_transaction ON COMMIT DROP AS
SELECT books_id, transaction_id FROM ledger_corporate_action
WHERE kind IN ('right_issue', 'right_exercise');
DELETE FROM ledger_corporate_action WHERE kind IN ('right_issue', 'right_exercise');
DELETE FROM ledger_transaction t USING right_transaction r
WHERE t.books_id = r.books_id AND t.id = r.transaction_id;

DELETE FROM ledger_transaction t USING ledger_trade d
WHERE d.cost = 0 AND t.books_id = d.books_id AND t.id = d.transaction_id;
ALTER TABLE ledger_trade DROP CONSTRAINT ledger_trade_cost_check;
ALTER TABLE ledger_trade ADD CONSTRAINT ledger_trade_cost_check CHECK (cost > 0);
DELETE FROM ledger_transaction t USING ledger_posting p
WHERE p.weight = 0 AND t.id = p.transaction_id;
ALTER TABLE ledger_posting DROP CONSTRAINT ledger_posting_weight_check;
ALTER TABLE ledger_posting ADD CONSTRAINT ledger_posting_weight_check
    CHECK (weight <> 0 AND abs(weight) <= 9007199254740991);
ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_value;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_value
    CHECK (kind IN ('bonus', 'unit_tax') OR (unit_cost IS NULL AND value = 0));

ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_exchange;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_exchange
    CHECK ((kind IN ('conversion', 'spin_off')) = (new_account_id IS NOT NULL)
        AND (kind = 'spin_off') = (cost_bp IS NOT NULL));
ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_ratio;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_ratio
    CHECK (kind IN ('conversion', 'spin_off') OR (kind = 'reverse_split') = (ratio_to < ratio_from));
ALTER TABLE ledger_corporate_action DROP CONSTRAINT ledger_corporate_action_kind_check;
ALTER TABLE ledger_corporate_action ADD CONSTRAINT ledger_corporate_action_kind_check
    CHECK (kind IN ('split', 'reverse_split', 'bonus', 'unit_tax', 'conversion', 'spin_off'));
