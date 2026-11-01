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
	booksID  int64
	checking string
	food     string
}

func newSchemaFixture(t *testing.T) schemaFixture {
	t.Helper()
	pool := pgtest.New(t)
	f := schemaFixture{pool: pool, booksID: pgtest.CreateBooks(t, pool)}
	f.checking = f.account(t, f.booksID, "asset", "checking", "2026-01-01")
	f.food = f.account(t, f.booksID, "expense", "", "2026-01-01")

	return f
}

func (f schemaFixture) account(t *testing.T, booksID int64, class, kind, openedOn string) string {
	t.Helper()
	var id string

	err := f.pool.QueryRow(t.Context(), `
		INSERT INTO ledger_account (books_id, name, account_class, kind, instrument, opened_on)
		VALUES ($1, $2, $3, nullif($4, ''), 'BRL', $5) RETURNING id`,
		booksID, class+"-"+kind+"-"+openedOn, class, kind, openedOn).Scan(&id)
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
func (f schemaFixture) recordTx(t *testing.T, booksID int64, date string, postings ...postingRow) (string, error) {
	t.Helper()
	var id string
	err := pgx.BeginFunc(t.Context(), f.pool, func(tx pgx.Tx) error {
		if err := tx.QueryRow(t.Context(), `
			INSERT INTO ledger_transaction (books_id, date, description, balancing_currency, origin)
			VALUES ($1, $2, 'test', 'BRL', 'manual') RETURNING id`, booksID, date).Scan(&id); err != nil {
			return err
		}

		for i, p := range postings {
			if _, err := tx.Exec(t.Context(), `
				INSERT INTO ledger_posting (books_id, transaction_id, account_id, position, amount, weight, booked_on, status)
				VALUES ($1, $2, $3, $4, $5, $5, $6, 'cleared')`, booksID, id, p.account, i, p.amount, date); err != nil {
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
	uniqueViolation     = "23505"
	notNullViolation    = "23502"
)

// A73: the account tree has no cycle.
func TestAccountTreeRejectsCycle(t *testing.T) {
	t.Parallel()
	f := newSchemaFixture(t)
	a := f.account(t, f.booksID, "expense", "", "2026-01-01")

	b := f.account(t, f.booksID, "expense", "", "2026-02-01")
	if _, err := f.pool.Exec(t.Context(), `UPDATE ledger_account SET parent_id = $1 WHERE id = $2`, a, b); err != nil {
		t.Fatal(err)
	}

	_, err := f.pool.Exec(t.Context(), `UPDATE ledger_account SET parent_id = $1 WHERE id = $2`, b, a)
	requireViolation(t, err, checkViolation, "own ancestor")
	_, err = f.pool.Exec(t.Context(), `UPDATE ledger_account SET parent_id = id WHERE id = $1`, a)
	requireViolation(t, err, checkViolation, "own ancestor")
}

// A83: colour is a data slot 1-8 and icon a kebab-case key.
func TestAccountAppearanceChecks(t *testing.T) {
	t.Parallel()
	f := newSchemaFixture(t)
	_, err := f.pool.Exec(t.Context(), `UPDATE ledger_account SET color = 9 WHERE id = $1`, f.food)
	requireViolation(t, err, checkViolation, "color")
	_, err = f.pool.Exec(t.Context(), `UPDATE ledger_account SET icon = 'Bad Icon' WHERE id = $1`, f.food)
	requireViolation(t, err, checkViolation, "icon")
}

func TestDBAcceptsBalancedTransaction(t *testing.T) {
	t.Parallel()

	f := newSchemaFixture(t)
	if _, err := f.recordTx(t, f.booksID, "2026-03-01", postingRow{f.checking, -10000}, postingRow{f.food, 10000}); err != nil {
		t.Fatal(err)
	}
}

func TestDBRejectsUnbalancedTransaction(t *testing.T) {
	t.Parallel()
	f := newSchemaFixture(t)
	_, err := f.recordTx(t, f.booksID, "2026-03-01", postingRow{f.checking, -9000}, postingRow{f.food, 10000})
	requireViolation(t, err, checkViolation, "unbalanced")
}

func TestDBRejectsSinglePosting(t *testing.T) {
	t.Parallel()
	f := newSchemaFixture(t)
	_, err := f.recordTx(t, f.booksID, "2026-03-01", postingRow{f.checking, -9000})
	requireViolation(t, err, checkViolation, "at least 2")
}

func TestDBIgnoresVoidedTransaction(t *testing.T) {
	t.Parallel()
	f := newSchemaFixture(t)

	id, err := f.recordTx(t, f.booksID, "2026-03-01", postingRow{f.checking, -10000}, postingRow{f.food, 10000})
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
	t.Parallel()
	f := newSchemaFixture(t)
	late := f.account(t, f.booksID, "asset", "cash", "2026-02-01")
	_, err := f.recordTx(t, f.booksID, "2026-01-31", postingRow{late, -100}, postingRow{f.food, 100})
	requireViolation(t, err, checkViolation, "not open")
}

func TestDBRejectsCrossUserAccount(t *testing.T) {
	t.Parallel()
	f := newSchemaFixture(t)
	other := pgtest.CreateBooks(t, f.pool)
	otherFood := f.account(t, other, "expense", "", "2026-01-01")
	_, err := f.recordTx(t, f.booksID, "2026-03-01", postingRow{f.checking, -100}, postingRow{otherFood, 100})
	requireViolation(t, err, foreignKeyViolation, "")
}

func TestDBRejectsClassKindMismatch(t *testing.T) {
	t.Parallel()

	f := newSchemaFixture(t)
	for _, c := range []struct{ class, kind string }{{"expense", "checking"}, {"liability", "cash"}, {"asset", ""}} {
		_, err := f.pool.Exec(context.Background(), `
			INSERT INTO ledger_account (books_id, name, account_class, kind, instrument, opened_on)
			VALUES ($1, 'x', $2, nullif($3, ''), 'BRL', '2026-01-01')`, f.booksID, c.class, c.kind)
		requireViolation(t, err, checkViolation, "")
	}
}

func TestDBForbidsUnvoid(t *testing.T) {
	t.Parallel()
	f := newSchemaFixture(t)

	id, err := f.recordTx(t, f.booksID, "2026-03-01", postingRow{f.checking, -100}, postingRow{f.food, 100})
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
	t.Parallel()
	f := newSchemaFixture(t)

	id, err := f.recordTx(t, f.booksID, "2026-03-01", postingRow{f.checking, -100}, postingRow{f.food, 100})
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
	t.Parallel()
	f := newSchemaFixture(t)
	ctx := t.Context()
	cash, other := f.checking, f.food

	id, err := f.recordTx(t, f.booksID, "2026-10-20", postingRow{cash, 100}, postingRow{other, -100})
	if err != nil {
		t.Fatal(err)
	}

	_, err = f.pool.Exec(ctx, `INSERT INTO ledger_trade (transaction_id, books_id, account_id, cash_account_id, side, quantity, unit_price, gross, fees, taxes, currency)
		VALUES ($1, $2, $3, $4, 'sell', 1, 1, 100, 0, 0, 'BRL')`, id, f.booksID, other, cash)
	requireViolation(t, err, checkViolation, "")
	_, err = f.pool.Exec(ctx, `INSERT INTO ledger_trade (transaction_id, books_id, account_id, cash_account_id, side, quantity, unit_price, gross, fees, taxes, currency)
		VALUES ($1, $2, $3, $4, 'buy', 1, 1, 100, 0, 5, 'BRL')`, id, f.booksID, other, cash)
	requireViolation(t, err, checkViolation, "")
}

// Spec §5.7: an identifier has a scheme, is set with it, and names one institution of a book.
func TestInstitutionIdentifierChecks(t *testing.T) {
	t.Parallel()
	f := newSchemaFixture(t)
	insert := `INSERT INTO ledger_institution (books_id, name, identifier_scheme, identifier) VALUES ($1, $2, $3, $4)`
	_, err := f.pool.Exec(t.Context(), insert, f.booksID, "Bad scheme", "Br-ISPB", "18236120")
	requireViolation(t, err, checkViolation, "identifier_scheme")
	_, err = f.pool.Exec(t.Context(), insert, f.booksID, "Empty", "bic", "")
	requireViolation(t, err, checkViolation, "identifier")
	_, err = f.pool.Exec(t.Context(), insert, f.booksID, "Long", "bic", strings.Repeat("A", 41))
	requireViolation(t, err, checkViolation, "identifier")
	_, err = f.pool.Exec(t.Context(), insert, f.booksID, "Half", "bic", nil)
	requireViolation(t, err, checkViolation, "")
	_, err = f.pool.Exec(t.Context(), insert, f.booksID, "Half", nil, "18236120")
	requireViolation(t, err, checkViolation, "")

	_, err = f.pool.Exec(t.Context(), insert, f.booksID, "Nubank", "br_ispb", "18236120")
	if err != nil {
		t.Fatalf("insert institution: %v", err)
	}

	_, err = f.pool.Exec(t.Context(), insert, f.booksID, "Nu", "br_ispb", "18236120")
	requireViolation(t, err, uniqueViolation, "identifier")
}

func TestTagNameSchema(t *testing.T) {
	t.Parallel()
	f := newSchemaFixture(t)
	insert := func(name string) error {
		_, err := f.pool.Exec(t.Context(), `INSERT INTO ledger_tag (books_id, name) VALUES ($1, $2)`, f.booksID, name)
		return err
	}
	requireViolation(t, insert("a b"), checkViolation, "")
	requireViolation(t, insert("-a"), checkViolation, "")
	requireViolation(t, insert(""), checkViolation, "")
	requireViolation(t, insert(strings.Repeat("é", 61)), checkViolation, "")

	for _, ok := range []string{"café", "праздник", strings.Repeat("é", 60)} {
		if err := insert(ok); err != nil {
			t.Fatalf("insert %q: %v", ok, err)
		}
	}
}

// Spec 5.9: income types are identifiers; the ledger does not enumerate them.
func TestDBInvestmentIncomeTypeIsAnIdentifier(t *testing.T) {
	t.Parallel()
	f := newSchemaFixture(t)

	id, err := f.recordTx(t, f.booksID, "2026-03-01", postingRow{f.checking, -10000}, postingRow{f.food, 10000})
	if err != nil {
		t.Fatal(err)
	}

	insert := func(incomeType string) error {
		_, err := f.pool.Exec(t.Context(), `
			INSERT INTO ledger_investment_income (transaction_id, books_id, account_id, cash_account_id, income_type, gross, withheld, currency)
			VALUES ($1, $2, $3, $3, $4, 100, 0, 'BRL')`, id, f.booksID, f.checking, incomeType)

		return err
	}
	requireViolation(t, insert("Bad!"), checkViolation, "income_type")

	if err := insert("rent"); err != nil {
		t.Fatalf("identifier rejected: %v", err)
	}
}

// A172 (I07): a record confirms one posting.
func TestDBRejectsOneRecordOnTwoPostings(t *testing.T) {
	t.Parallel()
	f := newSchemaFixture(t)

	var record string
	if err := f.pool.QueryRow(t.Context(), `SELECT gen_random_uuid()::text`).Scan(&record); err != nil {
		t.Fatal(err)
	}

	link := func() error {
		id, err := f.recordTx(t, f.booksID, "2026-03-01", postingRow{f.checking, -10000}, postingRow{f.food, 10000})
		if err != nil {
			t.Fatal(err)
		}

		_, err = f.pool.Exec(t.Context(),
			`UPDATE ledger_posting SET external_record_id = $1 WHERE transaction_id = $2 AND position = 0`, record, id)

		return err
	}

	if err := link(); err != nil {
		t.Fatal(err)
	}

	requireViolation(t, link(), uniqueViolation, "ledger_posting_external_record_idx")
}
