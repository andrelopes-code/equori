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
