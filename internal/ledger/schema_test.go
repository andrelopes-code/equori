package ledger

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

// Database-level invariants (chapter 7, 7.6; N04), exercised with raw SQL.

type schemaFixture struct {
	pool     *pgxpool.Pool
	userID   int64
	checking string
	food     string
}

func newSchemaFixture(t *testing.T) schemaFixture {
	t.Helper()
	pool := pgtest.New(t)
	f := schemaFixture{pool: pool, userID: pgtest.CreateUser(t, pool)}
	f.checking = f.account(t, f.userID, "asset", "checking", "2026-01-01")
	f.food = f.account(t, f.userID, "expense", "", "2026-01-01")
	return f
}

func (f schemaFixture) account(t *testing.T, userID int64, class, kind, openedOn string) string {
	t.Helper()
	var id string
	err := f.pool.QueryRow(t.Context(), `
		INSERT INTO ledger_account (user_id, name, account_class, kind, instrument, opened_on)
		VALUES ($1, $2, $3, nullif($4, ''), 'BRL', $5) RETURNING id`,
		userID, class+"-"+kind+"-"+openedOn, class, kind, openedOn).Scan(&id)
	if err != nil {
		t.Fatalf("insert account: %v", err)
	}
	return id
}

type postingRow struct {
	account string
	amount  int64
}

// recordTx inserts a transaction and its postings in one database transaction and returns the commit error.
func (f schemaFixture) recordTx(t *testing.T, userID int64, date string, postings ...postingRow) (string, error) {
	t.Helper()
	var id string
	err := pgx.BeginFunc(t.Context(), f.pool, func(tx pgx.Tx) error {
		if err := tx.QueryRow(t.Context(), `
			INSERT INTO ledger_transaction (user_id, date, description, balancing_currency, origin)
			VALUES ($1, $2, 'test', 'BRL', 'manual') RETURNING id`, userID, date).Scan(&id); err != nil {
			return err
		}
		for i, p := range postings {
			if _, err := tx.Exec(t.Context(), `
				INSERT INTO ledger_posting (user_id, transaction_id, account_id, position, amount, weight, booked_on, status)
				VALUES ($1, $2, $3, $4, $5, $5, $6, 'cleared')`, userID, id, p.account, i, p.amount, date); err != nil {
				return err
			}
		}
		return nil
	})
	return id, err
}

func requireViolation(t *testing.T, err error, code, contains string) {
	t.Helper()
	pgErr, ok := errors.AsType[*pgconn.PgError](err)
	if !ok {
		t.Fatalf("err = %v, want PostgreSQL error %s", err, code)
	}
	if pgErr.Code != code || !strings.Contains(pgErr.Message, contains) {
		t.Fatalf("err = %s %q, want %s containing %q", pgErr.Code, pgErr.Message, code, contains)
	}
}

const (
	checkViolation      = "23514"
	foreignKeyViolation = "23503"
)

func TestDBAcceptsBalancedTransaction(t *testing.T) {
	f := newSchemaFixture(t)
	if _, err := f.recordTx(t, f.userID, "2026-03-01", postingRow{f.checking, -10000}, postingRow{f.food, 10000}); err != nil {
		t.Fatal(err)
	}
}

func TestDBRejectsUnbalancedTransaction(t *testing.T) {
	f := newSchemaFixture(t)
	_, err := f.recordTx(t, f.userID, "2026-03-01", postingRow{f.checking, -9000}, postingRow{f.food, 10000})
	requireViolation(t, err, checkViolation, "unbalanced")
}

func TestDBRejectsSinglePosting(t *testing.T) {
	f := newSchemaFixture(t)
	_, err := f.recordTx(t, f.userID, "2026-03-01", postingRow{f.checking, -9000})
	requireViolation(t, err, checkViolation, "at least 2")
}

func TestDBIgnoresVoidedTransaction(t *testing.T) {
	f := newSchemaFixture(t)
	id, err := f.recordTx(t, f.userID, "2026-03-01", postingRow{f.checking, -10000}, postingRow{f.food, 10000})
	if err != nil {
		t.Fatal(err)
	}
	err = pgx.BeginFunc(t.Context(), f.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(t.Context(), `UPDATE ledger_transaction SET voided_at = now() WHERE id = $1`, id); err != nil {
			return err
		}
		_, err := tx.Exec(t.Context(), `DELETE FROM ledger_posting WHERE transaction_id = $1 AND position = 1`, id)
		return err
	})
	if err != nil {
		t.Fatalf("voided transaction still checked: %v", err)
	}
}

func TestDBRejectsPostingOutsideOpenPeriod(t *testing.T) {
	f := newSchemaFixture(t)
	late := f.account(t, f.userID, "asset", "cash", "2026-02-01")
	_, err := f.recordTx(t, f.userID, "2026-01-31", postingRow{late, -100}, postingRow{f.food, 100})
	requireViolation(t, err, checkViolation, "not open")
}

func TestDBRejectsCrossUserAccount(t *testing.T) {
	f := newSchemaFixture(t)
	other := pgtest.CreateUser(t, f.pool)
	otherFood := f.account(t, other, "expense", "", "2026-01-01")
	_, err := f.recordTx(t, f.userID, "2026-03-01", postingRow{f.checking, -100}, postingRow{otherFood, 100})
	requireViolation(t, err, foreignKeyViolation, "")
}

func TestDBRejectsClassKindMismatch(t *testing.T) {
	f := newSchemaFixture(t)
	for _, c := range []struct{ class, kind string }{{"expense", "checking"}, {"liability", "cash"}, {"asset", ""}} {
		_, err := f.pool.Exec(context.Background(), `
			INSERT INTO ledger_account (user_id, name, account_class, kind, instrument, opened_on)
			VALUES ($1, 'x', $2, nullif($3, ''), 'BRL', '2026-01-01')`, f.userID, c.class, c.kind)
		requireViolation(t, err, checkViolation, "")
	}
}

func TestDBForbidsUnvoid(t *testing.T) {
	f := newSchemaFixture(t)
	id, err := f.recordTx(t, f.userID, "2026-03-01", postingRow{f.checking, -100}, postingRow{f.food, 100})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(t.Context(), `UPDATE ledger_transaction SET voided_at = now() WHERE id = $1`, id); err != nil {
		t.Fatal(err)
	}
	_, err = f.pool.Exec(t.Context(), `UPDATE ledger_transaction SET voided_at = NULL WHERE id = $1`, id)
	requireViolation(t, err, checkViolation, "cannot be restored")
}

func TestDBBookedOnFollowsDate(t *testing.T) {
	f := newSchemaFixture(t)
	id, err := f.recordTx(t, f.userID, "2026-03-01", postingRow{f.checking, -100}, postingRow{f.food, 100})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(t.Context(), `UPDATE ledger_transaction SET date = '2026-03-05' WHERE id = $1`, id); err != nil {
		t.Fatal(err)
	}
	var n int
	err = f.pool.QueryRow(t.Context(),
		`SELECT count(*) FROM ledger_posting WHERE transaction_id = $1 AND booked_on = '2026-03-05'`, id).Scan(&n)
	if err != nil || n != 2 {
		t.Fatalf("postings with new booked_on = %d, %v; want 2", n, err)
	}
}

func TestDBRejectsSaleWithoutCost(t *testing.T) {
	f := newSchemaFixture(t)
	ctx := t.Context()
	cash, other := f.checking, f.food
	id, err := f.recordTx(t, f.userID, "2026-10-20", postingRow{cash, 100}, postingRow{other, -100})
	if err != nil {
		t.Fatal(err)
	}
	_, err = f.pool.Exec(ctx, `INSERT INTO ledger_trade (transaction_id, user_id, account_id, cash_account_id, side, quantity, unit_price, gross, fees, taxes, currency)
		VALUES ($1, $2, $3, $4, 'sell', 1, 1, 100, 0, 0, 'BRL')`, id, f.userID, other, cash)
	requireViolation(t, err, checkViolation, "")
	_, err = f.pool.Exec(ctx, `INSERT INTO ledger_trade (transaction_id, user_id, account_id, cash_account_id, side, quantity, unit_price, gross, fees, taxes, currency)
		VALUES ($1, $2, $3, $4, 'buy', 1, 1, 100, 0, 5, 'BRL')`, id, f.userID, other, cash)
	requireViolation(t, err, checkViolation, "")
}
