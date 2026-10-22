package ledger

import "testing"

func TestDBLinkAmountConstraint(t *testing.T) {
	t.Parallel()
	f := newCardFixture(t)
	spent, err := f.recordTx(t, f.userID, "2026-10-17", postingRow{f.checking, -1500}, postingRow{f.food, 1500})
	if err != nil {
		t.Fatal(err)
	}
	received, err := f.recordTx(t, f.userID, "2026-10-20", postingRow{f.checking, 1500}, postingRow{f.food, -1500})
	if err != nil {
		t.Fatal(err)
	}
	insert := func(linkType string, amount any) error {
		_, err := f.pool.Exec(t.Context(), `
			INSERT INTO ledger_link (user_id, from_transaction_id, to_transaction_id, link_type, amount)
			VALUES ($1, $2, $3, $4, $5)`, f.userID, received, spent, linkType, amount)
		return err
	}
	requireViolation(t, insert("reimbursement_of", int64(0)), checkViolation, "")
	requireViolation(t, insert("reimbursement_of", int64(-1)), checkViolation, "")
	requireViolation(t, insert("refund_of", int64(100)), checkViolation, "")
	if err := insert("reimbursement_of", int64(100)); err != nil {
		t.Fatal(err)
	}
	if err := insert("refund_of", nil); err != nil {
		t.Fatal(err)
	}
}
