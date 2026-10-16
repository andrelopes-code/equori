package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

func TestSchemaInvariants(t *testing.T) {
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
	if err := h.Pool.QueryRow(ctx, `INSERT INTO ingestion_batch (user_id, account_id, source, file_name, currency) VALUES ($1, $2, 'ofx', 'a.ofx', 'BRL') RETURNING id`, uid, checking).Scan(&batch); err != nil {
		t.Fatal(err)
	}
	record := func(key byte, state string, transaction any) error {
		return exec(`INSERT INTO ingestion_external_record (user_id, batch_id, account_id, dedup_key, raw, booked_on, amount, description, state, transaction_id)
			VALUES ($1, $2, $3, $4, '{}', '2026-10-01', -100, 'x', $5, $6)`, uid, batch, checking, append(make([]byte, 31), key), state, transaction)
	}
	if err := record(1, "created", tx); err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name string
		err  error
	}{
		{"I10: a deduplication key once per user", record(1, "received", nil)},
		{"I07: a transaction linked to one record", record(2, "matched", tx)},
		{"a created record names its transaction", record(3, "created", nil)},
		{"a received record names no transaction", record(4, "received", tx)},
		{"profile with an amount column and debit and credit columns", exec(`INSERT INTO ingestion_csv_profile
			(user_id, account_id, date_column, date_layout, amount_column, debit_column, credit_column, decimal_separator, description_column)
			VALUES ($1, $2, 'Data', 'DD/MM/YYYY', 'Valor', 'Débito', 'Crédito', ',', 'Descrição')`, uid, checking)},
		{"profile without amount columns", exec(`INSERT INTO ingestion_csv_profile
			(user_id, account_id, date_column, date_layout, decimal_separator, description_column)
			VALUES ($1, $2, 'Data', 'DD/MM/YYYY', ',', 'Descrição')`, uid, checking)},
	}
	for _, tc := range tests {
		if tc.err == nil {
			t.Errorf("%s: accepted", tc.name)
		}
	}
}

func TestImportBatchListStartsEmpty(t *testing.T) {
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
	var otherID int64
	var otherAccount, integration, connection string
	if err := h.Pool.QueryRow(ctx, `SELECT id FROM identity_user WHERE email = 'other@example.com'`).Scan(&otherID); err != nil {
		t.Fatal(err)
	}
	if err := h.Pool.QueryRow(ctx, `SELECT id FROM ledger_account WHERE user_id = $1 LIMIT 1`, otherID).Scan(&otherAccount); err != nil {
		t.Fatal(err)
	}
	if err := h.Pool.QueryRow(ctx, `INSERT INTO ingestion_integration (id, user_id, provider, name, credential_ciphertext) VALUES (uuidv7(), $1, 'pluggy', 'Meu Pluggy', '\x01') RETURNING id`, uid).Scan(&integration); err != nil {
		t.Fatal(err)
	}
	if err := h.Pool.QueryRow(ctx, `INSERT INTO ingestion_connection (user_id, integration_id, external_item_id, name, provider_status) VALUES ($1, $2, 'item-1', 'Nubank', 'UPDATED') RETURNING id`, uid, integration).Scan(&connection); err != nil {
		t.Fatal(err)
	}
	external := func(id string, account any, syncFrom any, ignored bool) error {
		return exec(`INSERT INTO ingestion_external_account (user_id, connection_id, external_account_id, type, subtype, name, currency, account_id, sync_from, ignored)
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
		return exec(`INSERT INTO ingestion_batch (user_id, account_id, source, file_name, currency, external_account_id)
			VALUES ($1, $2, $3, $4, 'BRL', $5)`, uid, checking, source, name, externalAccount)
	}
	tests := []struct {
		name string
		err  error
	}{
		{"A34: an integration name once per user", exec(`INSERT INTO ingestion_integration (id, user_id, provider, name, credential_ciphertext) VALUES (uuidv7(), $1, 'pluggy', 'Meu Pluggy', '\x01')`, uid)},
		{"A34: an integration with connections is not deleted", exec(`DELETE FROM ingestion_integration WHERE id = $1`, integration)},
		{"an item once per integration", exec(`INSERT INTO ingestion_connection (user_id, integration_id, external_item_id, name, provider_status) VALUES ($1, $2, 'item-1', 'Again', 'UPDATED')`, uid, integration)},
		{"A35: one feed per ledger account", external("acc-2", checking, "2026-10-01", false)},
		{"A35: a mapped account has a start date", external("acc-3", savings, nil, false)},
		{"A35: an ignored account is not mapped", external("acc-4", savings, "2026-10-01", true)},
		{"ADR 003: a mapping stays within its user", external("acc-5", otherAccount, "2026-10-01", false)},
		{"a file batch has a file name", batch("ofx", "", nil)},
		{"an aggregator batch has no file name", batch("open_finance", "sync.json", nil)},
		{"a file batch has no external account", exec(`INSERT INTO ingestion_batch (user_id, account_id, source, file_name, currency, external_account_id)
			SELECT $1, $2, 'ofx', 'a.ofx', 'BRL', id FROM ingestion_external_account WHERE external_account_id = 'acc-1'`, uid, checking)},
	}
	for _, tc := range tests {
		if tc.err == nil {
			t.Errorf("%s: accepted", tc.name)
		}
	}
}
