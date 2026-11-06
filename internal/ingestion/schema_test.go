package ingestion_test

import (
	"errors"
	"net/http"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/postgres/pgtest"
)

func TestSchemaInvariants(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	tx := h.Record("2026-10-01", apitest.Posting(checking, -100), apitest.Posting(food, 100))
	uid := h.OwnerID()
	ctx := t.Context()
	exec := func(sql string, args ...any) error {
		_, err := h.Pool.Exec(ctx, sql, args...)
		return err
	}

	var batch string
	if err := h.Pool.QueryRow(ctx, `INSERT INTO ingestion_batch (books_id, account_id, source, file_name, currency) VALUES ($1, $2, 'ofx', 'a.ofx', 'BRL') RETURNING id`, uid, checking).Scan(&batch); err != nil {
		t.Fatal(err)
	}

	record := func(key byte, state string, transaction any) error {
		return exec(`INSERT INTO ingestion_external_record (books_id, batch_id, account_id, dedup_key, raw, booked_on, amount, reported_amount, reported_on, description, state, transaction_id)
			VALUES ($1, $2, $3, $4, '{}', '2026-10-01', -100, -100, '2026-10-01', 'x', $5, $6)`, uid, batch, checking, append(make([]byte, 31), key), state, transaction)
	}
	if err := record(1, "created", tx); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name string
		err  error
	}{
		{"I10: a deduplication key once per book", record(1, "received", nil)},
		{"a created record names its transaction", record(3, "created", nil)},
		{"a received record names no transaction", record(4, "received", tx)},
		{"an institution line id is never empty", exec(`INSERT INTO ingestion_external_record (books_id, batch_id, account_id, dedup_key, raw, booked_on, amount, reported_amount, reported_on, description, institution_id)
			VALUES ($1, $2, $3, $4, '{}', '2026-10-01', -100, -100, '2026-10-01', 'x', '')`, uid, batch, checking, append(make([]byte, 31), 10))},
		{"a record holds the reported amount", exec(`INSERT INTO ingestion_external_record (books_id, batch_id, account_id, dedup_key, raw, booked_on, amount, reported_amount, reported_on, description)
			VALUES ($1, $2, $3, $4, '{}', '2026-10-01', -100, NULL, '2026-10-01', 'x')`, uid, batch, checking, append(make([]byte, 31), 11))},
		{"a record decision outside the closed set", exec(`INSERT INTO ingestion_external_record (books_id, batch_id, account_id, dedup_key, raw, booked_on, amount, reported_amount, reported_on, description, state, decision)
			VALUES ($1, $2, $3, $4, '{}', '2026-10-01', -100, -100, '2026-10-01', 'x', 'received', 'other')`, uid, batch, checking, append(make([]byte, 31), 20))},
		{"a file batch carries no sync run", exec(`INSERT INTO ingestion_batch (books_id, account_id, source, file_name, currency, sync_id)
			VALUES ($1, $2, 'ofx', 'b.ofx', 'BRL', gen_random_uuid())`, uid, checking)},
		{"profile with an amount column and debit and credit columns", exec(`INSERT INTO ingestion_csv_profile
			(books_id, account_id, date_column, date_layout, amount_column, debit_column, credit_column, decimal_separator, description_column)
			VALUES ($1, $2, 'Data', 'DD/MM/YYYY', 'Valor', 'Débito', 'Crédito', ',', 'Descrição')`, uid, checking)},
		{"an installment within its count", exec(`INSERT INTO ingestion_external_record (books_id, batch_id, account_id, dedup_key, raw, booked_on, amount, reported_amount, reported_on, description, installment_number, installment_count)
			VALUES ($1, $2, $3, $4, '{}', '2026-10-01', -100, -100, '2026-10-01', 'x', 7, 6)`, uid, batch, checking, append(make([]byte, 31), 9))},
		{"profile encoding outside the identifier pattern", exec(`INSERT INTO ingestion_csv_profile
			(books_id, account_id, date_column, date_layout, amount_column, decimal_separator, description_column, encoding)
			VALUES ($1, $2, 'Data', 'DD/MM/YYYY', 'Valor', ',', 'Descrição', 'Windows 1252')`, uid, checking)},
		{"profile date layout outside the token pattern", exec(`INSERT INTO ingestion_csv_profile
			(books_id, account_id, date_column, date_layout, amount_column, decimal_separator, description_column)
			VALUES ($1, $2, 'Data', 'D/M/YYYY', 'Valor', ',', 'Descrição')`, uid, checking)},
		{"profile date layout mixing separators", exec(`INSERT INTO ingestion_csv_profile
			(books_id, account_id, date_column, date_layout, amount_column, decimal_separator, description_column)
			VALUES ($1, $2, 'Data', 'DD/MM-YYYY', 'Valor', ',', 'Descrição')`, uid, checking)},
		{"profile group separator outside the allowed set", exec(`INSERT INTO ingestion_csv_profile
			(books_id, account_id, date_column, date_layout, amount_column, decimal_separator, description_column, group_separator)
			VALUES ($1, $2, 'Data', 'DD/MM/YYYY', 'Valor', ',', 'Descrição', ';')`, uid, checking)},
		{"profile without amount columns", exec(`INSERT INTO ingestion_csv_profile
			(books_id, account_id, date_column, date_layout, decimal_separator, description_column)
			VALUES ($1, $2, 'Data', 'DD/MM/YYYY', ',', 'Descrição')`, uid, checking)},
		{"profile footer rows above ten", exec(`INSERT INTO ingestion_csv_profile
			(books_id, account_id, date_column, date_layout, amount_column, decimal_separator, description_column, footer_rows)
			VALUES ($1, $2, 'Data', 'DD/MM/YYYY', 'Valor', ',', 'Descrição', 11)`, uid, checking)},
		{"profile sign column without a debit marker", exec(`INSERT INTO ingestion_csv_profile
			(books_id, account_id, date_column, date_layout, amount_column, decimal_separator, description_column, sign_column)
			VALUES ($1, $2, 'Data', 'DD/MM/YYYY', 'Valor', ',', 'Descrição', 'Tipo')`, uid, checking)},
		{"profile debit marker with debit and credit columns", exec(`INSERT INTO ingestion_csv_profile
			(books_id, account_id, date_column, date_layout, debit_column, credit_column, decimal_separator, description_column, debit_marker)
			VALUES ($1, $2, 'Data', 'DD/MM/YYYY', 'Débito', 'Crédito', ',', 'Descrição', 'D')`, uid, checking)},
		{"profile debit marker empty", exec(`INSERT INTO ingestion_csv_profile
			(books_id, account_id, date_column, date_layout, amount_column, decimal_separator, description_column, debit_marker)
			VALUES ($1, $2, 'Data', 'DD/MM/YYYY', 'Valor', ',', 'Descrição', '')`, uid, checking)},
	}
	for _, tc := range tests {
		if tc.err == nil {
			t.Errorf("%s: accepted", tc.name)
		}
	}
}

func TestImportBatchListStartsEmpty(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	var out struct {
		Items []any `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/import-batches", nil, http.StatusOK, &out)

	if len(out.Items) != 0 {
		t.Fatalf("items = %v", out.Items)
	}
}

func TestConnectionSchemaInvariants(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	savings := h.Account("Savings", "asset", "savings", nil)
	h.Login("other@example.com")
	uid := h.OwnerID()
	ctx := t.Context()
	exec := func(sql string, args ...any) error {
		_, err := h.Pool.Exec(ctx, sql, args...)
		return err
	}
	var otherAccount, integration, connection string

	otherID := h.BooksIDOf("other@example.com")

	if err := h.Pool.QueryRow(ctx, `SELECT id FROM ledger_account WHERE books_id = $1 LIMIT 1`, otherID).Scan(&otherAccount); err != nil {
		t.Fatal(err)
	}

	if err := h.Pool.QueryRow(ctx, `INSERT INTO ingestion_integration (id, books_id, aggregator, name, credential_ciphertext) VALUES (uuidv7(), $1, 'pluggy', 'Meu Pluggy', '\x01') RETURNING id`, uid).Scan(&integration); err != nil {
		t.Fatal(err)
	}

	if err := h.Pool.QueryRow(ctx, `INSERT INTO ingestion_connection (books_id, integration_id, external_id, name, provider_status) VALUES ($1, $2, 'item-1', 'Nubank', 'UPDATED') RETURNING id`, uid, integration).Scan(&connection); err != nil {
		t.Fatal(err)
	}

	external := func(id string, account any, syncFrom any, ignored bool) error {
		return exec(`INSERT INTO ingestion_external_account (books_id, connection_id, external_account_id, type, subtype, name, currency, account_id, sync_from, ignored)
			VALUES ($1, $2, $3, 'BANK', 'CHECKING_ACCOUNT', 'Conta', 'BRL', $4, $5, $6)`, uid, connection, id, account, syncFrom, ignored)
	}
	if err := external("acc-1", checking, "2026-10-01", false); err != nil {
		t.Fatal(err)
	}

	batch := func(source, fileName string, externalAccount any) error {
		var name any
		if fileName != "" {
			name = fileName
		}

		return exec(`INSERT INTO ingestion_batch (books_id, account_id, source, file_name, currency, external_account_id)
			VALUES ($1, $2, $3, $4, 'BRL', $5)`, uid, checking, source, name, externalAccount)
	}

	tests := []struct {
		name string
		err  error
	}{
		{"A34: an integration name once per book", exec(`INSERT INTO ingestion_integration (id, books_id, aggregator, name, credential_ciphertext) VALUES (uuidv7(), $1, 'pluggy', 'Meu Pluggy', '\x01')`, uid)},
		{"A34: an integration with connections is not deleted", exec(`DELETE FROM ingestion_integration WHERE id = $1`, integration)},
		{"an item once per integration", exec(`INSERT INTO ingestion_connection (books_id, integration_id, external_id, name, provider_status) VALUES ($1, $2, 'item-1', 'Again', 'UPDATED')`, uid, integration)},
		{"A35: one feed per ledger account", external("acc-2", checking, "2026-10-01", false)},
		{"A35: a mapped account has a start date", external("acc-3", savings, nil, false)},
		{"A35: an ignored account is not mapped", external("acc-4", savings, "2026-10-01", true)},
		{"ADR 003: a mapping stays within its book", external("acc-5", otherAccount, "2026-10-01", false)},
		{"an aggregator is an identifier", exec(`INSERT INTO ingestion_integration (id, books_id, aggregator, name, credential_ciphertext) VALUES (uuidv7(), $1, 'Bad Id', 'Other', '\x01')`, uid)},
		{"open_finance is no batch source", batch("open_finance", "", nil)},
		{"a file batch has a file name", batch("ofx", "", nil)},
		{"an aggregator batch has no file name", batch("aggregator", "sync.json", nil)},
		{"A40: an installment key names a ledger plan", exec(`INSERT INTO ingestion_installment_plan (books_id, account_id, plan_key, plan_id)
			VALUES ($1, $2, $3, uuidv7())`, uid, checking, make([]byte, 32))},
		{"a file batch has no external account", exec(`INSERT INTO ingestion_batch (books_id, account_id, source, file_name, currency, external_account_id)
			SELECT $1, $2, 'ofx', 'a.ofx', 'BRL', id FROM ingestion_external_account WHERE external_account_id = 'acc-1'`, uid, checking)},
	}
	for _, tc := range tests {
		if tc.err == nil {
			t.Errorf("%s: accepted", tc.name)
		}
	}
}

func TestInstanceSettingsSchema(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)

	// Each statement runs after the previous one: the third accepted row makes the last a duplicate.
	for _, tt := range []struct {
		sql  string
		code string
	}{
		{`INSERT INTO ingestion_instance_settings (id, sync_interval_minutes) VALUES (false, 60)`, "23514"},
		{`INSERT INTO ingestion_instance_settings (sync_interval_minutes) VALUES (0)`, "23514"},
		{`INSERT INTO ingestion_instance_settings (sync_interval_minutes) VALUES (1441)`, "23514"},
		{`INSERT INTO ingestion_instance_settings (sync_interval_minutes) VALUES (60)`, ""},
		{`INSERT INTO ingestion_instance_settings (sync_interval_minutes) VALUES (30)`, "23505"},
	} {
		_, err := pool.Exec(t.Context(), tt.sql)

		pgErr, ok := errors.AsType[*pgconn.PgError](err)
		switch {
		case tt.code == "" && err != nil:
			t.Errorf("%s: error = %v, want none", tt.sql, err)
		case tt.code != "" && (!ok || pgErr.Code != tt.code):
			t.Errorf("%s: error = %v, want code %s", tt.sql, err, tt.code)
		}
	}
}
