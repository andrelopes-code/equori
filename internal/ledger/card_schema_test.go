package ledger

import (
	"testing"

	"github.com/jackc/pgx/v5"
)

// Database invariants of the card schema (I03, I04, A3 version of I05).

type cardFixture struct {
	schemaFixture
	card, otherCard, statement, otherStatement string
}

func newCardFixture(t *testing.T) cardFixture {
	t.Helper()
	f := cardFixture{schemaFixture: newSchemaFixture(t)}
	f.card = f.account(t, f.userID, "liability", "credit_card", "2026-01-01")
	f.otherCard = f.account(t, f.userID, "liability", "credit_card", "2026-01-02")
	f.statement = f.statementFor(t, f.card)
	f.otherStatement = f.statementFor(t, f.otherCard)
	return f
}

func (f cardFixture) statementFor(t *testing.T, account string) string {
	t.Helper()
	var id string
	err := f.pool.QueryRow(t.Context(), `
		INSERT INTO ledger_statement (user_id, account_id, reference_month, closing_date, due_date)
		VALUES ($1, $2, '2026-11-01', '2026-11-03', '2026-11-10') RETURNING id`, f.userID, account).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

type cardPosting struct {
	account, statement, role string
	amount                   int64
}

func (f cardFixture) recordCard(t *testing.T, postings ...cardPosting) (string, error) {
	t.Helper()
	var id string
	err := pgx.BeginFunc(t.Context(), f.pool, func(tx pgx.Tx) error {
		if err := tx.QueryRow(t.Context(), `
			INSERT INTO ledger_transaction (user_id, date, description, balancing_currency, origin)
			VALUES ($1, '2026-10-14', 'card', 'BRL', 'manual') RETURNING id`, f.userID).Scan(&id); err != nil {
			return err
		}
		for i, p := range postings {
			if _, err := tx.Exec(t.Context(), `
				INSERT INTO ledger_posting (user_id, transaction_id, account_id, position, amount, weight, booked_on, status, statement_id, card_role)
				VALUES ($1, $2, $3, $4, $5, $5, '2026-10-14', 'cleared', nullif($6, '')::uuid, nullif($7, ''))`,
				f.userID, id, p.account, i, p.amount, p.statement, p.role); err != nil {
				return err
			}
		}
		return nil
	})
	return id, err
}

func TestDBAcceptsBilledCardPosting(t *testing.T) {
	f := newCardFixture(t)
	if _, err := f.recordCard(t, cardPosting{f.card, f.statement, "charge", -23000}, cardPosting{account: f.food, amount: 23000}); err != nil {
		t.Fatal(err)
	}
}

func TestDBRejectsCardPostingWithoutStatement(t *testing.T) {
	f := newCardFixture(t)
	_, err := f.recordCard(t, cardPosting{account: f.card, amount: -100}, cardPosting{account: f.food, amount: 100})
	requireViolation(t, err, checkViolation, "statement")
}

func TestDBRejectsStatementOnNonCardPosting(t *testing.T) {
	f := newCardFixture(t)
	_, err := f.recordCard(t, cardPosting{f.checking, f.statement, "charge", -100}, cardPosting{account: f.food, amount: 100})
	requireViolation(t, err, checkViolation, "statement")
}

func TestDBRejectsStatementOfAnotherCard(t *testing.T) {
	f := newCardFixture(t)
	_, err := f.recordCard(t, cardPosting{f.card, f.otherStatement, "charge", -100}, cardPosting{account: f.food, amount: 100})
	requireViolation(t, err, checkViolation, "statement")
}

func TestDBRejectsRoleWithoutStatement(t *testing.T) {
	f := newCardFixture(t)
	_, err := f.recordCard(t, cardPosting{account: f.checking, role: "charge", amount: -100}, cardPosting{account: f.food, amount: 100})
	requireViolation(t, err, checkViolation, "")
}

func TestDBProtectsReconciledPostings(t *testing.T) {
	f := newCardFixture(t)
	id, err := f.recordTx(t, f.userID, "2026-03-01", postingRow{f.checking, -100}, postingRow{f.food, 100})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(t.Context(), `UPDATE ledger_posting SET status = 'reconciled' WHERE transaction_id = $1`, id); err != nil {
		t.Fatal(err)
	}

	_, err = f.pool.Exec(t.Context(), `UPDATE ledger_posting SET amount = -200, weight = -200 WHERE transaction_id = $1 AND position = 0`, id)
	requireViolation(t, err, checkViolation, "reconciled")
	_, err = f.pool.Exec(t.Context(), `DELETE FROM ledger_posting WHERE transaction_id = $1`, id)
	requireViolation(t, err, checkViolation, "reconciled")

	if _, err := f.pool.Exec(t.Context(), `UPDATE ledger_transaction SET voided_at = now() WHERE id = $1`, id); err != nil {
		t.Fatalf("voiding a transaction with reconciled postings: %v", err)
	}
}

func TestDBOneOpenDisputePerTransaction(t *testing.T) {
	f := newCardFixture(t)
	id, err := f.recordCard(t, cardPosting{f.card, f.statement, "charge", -100}, cardPosting{account: f.food, amount: 100})
	if err != nil {
		t.Fatal(err)
	}
	insert := `INSERT INTO ledger_dispute (user_id, transaction_id, opened_on) VALUES ($1, $2, '2026-11-05')`
	if _, err := f.pool.Exec(t.Context(), insert, f.userID, id); err != nil {
		t.Fatal(err)
	}
	_, err = f.pool.Exec(t.Context(), insert, f.userID, id)
	requireViolation(t, err, "23505", "")
}

func TestDBBillingRuleStartsOnFirstDay(t *testing.T) {
	f := newCardFixture(t)
	_, err := f.pool.Exec(t.Context(), `
		INSERT INTO ledger_billing_cycle_rule (user_id, account_id, effective_from, closing_day, due_day)
		VALUES ($1, $2, '2026-11-02', 3, 10)`, f.userID, f.card)
	requireViolation(t, err, checkViolation, "")
}
