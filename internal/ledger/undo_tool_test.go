package ledger_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// V19: the undo of record_transaction voids the transaction it recorded.
func TestUndoRecordTransactionVoidsIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t, apitest.Today("2026-10-23"))
	args := map[string]any{
		"date":            "2026-10-20",
		"description":     "Padaria",
		"amount":          "12.50",
		"from_account_id": f.checking,
		"to_account_id":   f.food,
	}

	r := f.h.Tool("record_transaction", args)
	if r.IsError {
		t.Fatalf("record = %s", r.Content)
	}

	b, _ := json.Marshal(args)

	u, ok := f.h.Undo("record_transaction", string(b), string(r.Content))
	if !ok || u.Tool != "void_transaction" {
		t.Fatalf("undo = %+v, %v", u, ok)
	}

	var in map[string]any
	if err := json.Unmarshal(u.Arguments, &in); err != nil {
		t.Fatal(err)
	}

	if v := f.h.Tool(u.Tool, in); v.IsError {
		t.Fatalf("void = %s", v.Content)
	}

	var tx struct {
		VoidedAt string `json:"voided_at"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/transactions/"+in["transaction_id"].(string),
		nil,
		http.StatusOK,
		&tx,
	)

	if tx.VoidedAt == "" || in["reason"] != "undone" {
		t.Fatalf("voided_at = %q, undo args = %v", tx.VoidedAt, in)
	}
}

// V19: the inverse each ledger write derives from its call, or none.
func TestUndoLedgerWrites(t *testing.T) {
	t.Parallel()

	h := apitest.New(t)

	tests := []struct {
		name, tool, args, result string
		want, wantArgs           string
	}{
		{
			name:     "investment",
			tool:     "record_investment",
			args:     `{"kind":"buy","date":"2026-10-20"}`,
			result:   `{"transaction_id":"t1"}`,
			want:     "void_transaction",
			wantArgs: `{"transaction_id":"t1","reason":"undone"}`,
		},
		{
			name:   "investment correction",
			tool:   "record_investment",
			args:   `{"kind":"buy","date":"2026-10-20","transaction_id":"t0","reason":"x"}`,
			result: `{"transaction_id":"t0"}`,
		},
		{
			name:     "fixed income",
			tool:     "record_fixed_income",
			args:     `{"brokerage_id":"b","applied_on":"2026-10-20","amount":"100"}`,
			result:   `{"instrument":"CDB","transaction_id":"t2","quantity":"1","unit_price":"100"}`,
			want:     "void_transaction",
			wantArgs: `{"transaction_id":"t2","reason":"undone"}`,
		},
		{
			name:     "custody",
			tool:     "transfer_custody",
			args:     `{"account_id":"a","brokerage_id":"b","date":"2026-10-20","quantity":"1"}`,
			result:   `{"transaction_id":"t3"}`,
			want:     "void_transaction",
			wantArgs: `{"transaction_id":"t3","reason":"undone"}`,
		},
		{
			name:     "corporate action",
			tool:     "record_corporate_action",
			args:     `{"kind":"split","date":"2026-10-20"}`,
			result:   `{"transaction_id":"t4"}`,
			want:     "void_transaction",
			wantArgs: `{"transaction_id":"t4","reason":"undone"}`,
		},
		{
			name:     "attachment",
			tool:     "attach_file",
			args:     `{"file_id":"f","transaction_id":"t"}`,
			result:   `{"attachment_id":"at1","file_name":"nota.pdf"}`,
			want:     "detach_attachment",
			wantArgs: `{"attachment_id":"at1"}`,
		},
		{
			name:     "card added",
			tool:     "manage_card",
			args:     `{"account_id":"c","action":"add_card","holder":"A","last_four":"1234"}`,
			result:   `{"account_id":"c","action":"add_card","id":"k1"}`,
			want:     "manage_card",
			wantArgs: `{"account_id":"c","action":"remove_card","card_id":"k1"}`,
		},
		{
			name:     "card deactivated",
			tool:     "manage_card",
			args:     `{"account_id":"c","action":"set_card_active","card_id":"k1"}`,
			result:   `{"account_id":"c","action":"set_card_active","id":"k1"}`,
			want:     "manage_card",
			wantArgs: `{"account_id":"c","action":"set_card_active","card_id":"k1","active":true}`,
		},
		{
			name:   "credit limit",
			tool:   "manage_card",
			args:   `{"account_id":"c","action":"set_credit_limit","amount":"100"}`,
			result: `{"account_id":"c","action":"set_credit_limit","id":"c"}`,
		},
		{
			name:     "account closed",
			tool:     "manage_accounts_and_payees",
			args:     `{"action":"close_account","account_id":"a1"}`,
			result:   `{"action":"close_account","id":"a1","name":"Nubank"}`,
			want:     "manage_accounts_and_payees",
			wantArgs: `{"action":"reopen_account","account_id":"a1"}`,
		},
		{
			name:   "payees merged",
			tool:   "manage_accounts_and_payees",
			args:   `{"action":"merge_payee","payee_id":"p1","into_id":"p2"}`,
			result: `{"action":"merge_payee","id":"p2","name":"X"}`,
		},
		{
			name:   "void",
			tool:   "void_transaction",
			args:   `{"transaction_id":"t","reason":"x"}`,
			result: `{"transaction_id":"t","voided":true}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			u, ok := h.Undo(tt.tool, tt.args, tt.result)

			if ok != (tt.want != "") || u.Tool != tt.want {
				t.Fatalf("undo = %s %s, %v; want %s", u.Tool, u.Arguments, ok, tt.want)
			}

			if ok && string(u.Arguments) != tt.wantArgs {
				t.Fatalf("arguments = %s, want %s", u.Arguments, tt.wantArgs)
			}
		})
	}
}
