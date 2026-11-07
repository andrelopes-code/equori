package ingestion_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	pluggy "github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
)

// S346 (A215): a file line with another description or another FITID waits instead of creating
// a second transaction; a line whose key already exists stays ignored.
func TestS346RepeatedFileLine(t *testing.T) {
	t.Parallel()

	const date, amount = "20261005", "-50.00"

	tests := []struct {
		name         string
		first, again apitest.OFXLine
		want         string
		wantTxs      int
	}{
		{
			name:    "no FITID, another description",
			first:   apitest.OFXLine{Date: date, Amount: amount, Name: "PADARIA CENTRAL"},
			again:   apitest.OFXLine{Date: date, Amount: amount, Name: "PADARIA CENTRAL LTDA"},
			want:    "received 1 ignored 0 matched 0 created 0 review 1",
			wantTxs: 1,
		},
		{
			name:    "no FITID, another case and spacing",
			first:   apitest.OFXLine{Date: date, Amount: amount, Name: "PADARIA CENTRAL"},
			again:   apitest.OFXLine{Date: date, Amount: amount, Name: "padaria  central"},
			want:    "received 1 ignored 1 matched 0 created 0 review 0",
			wantTxs: 1,
		},
		{
			name:    "same FITID, another description",
			first:   apitest.OFXLine{Date: date, Amount: amount, FITID: "a", Name: "PADARIA CENTRAL"},
			again:   apitest.OFXLine{Date: date, Amount: amount, FITID: "a", Name: "OUTRO NOME"},
			want:    "received 1 ignored 1 matched 0 created 0 review 0",
			wantTxs: 1,
		},
		{
			name:    "another FITID, same description",
			first:   apitest.OFXLine{Date: date, Amount: amount, FITID: "a", Name: "PADARIA CENTRAL"},
			again:   apitest.OFXLine{Date: date, Amount: amount, FITID: "b", Name: "PADARIA CENTRAL"},
			want:    "received 1 ignored 0 matched 0 created 0 review 1",
			wantTxs: 1,
		},
		{
			name:    "a FITID it lacked",
			first:   apitest.OFXLine{Date: date, Amount: amount, Name: "PADARIA CENTRAL"},
			again:   apitest.OFXLine{Date: date, Amount: amount, FITID: "b", Name: "PADARIA CENTRAL"},
			want:    "received 1 ignored 0 matched 0 created 0 review 1",
			wantTxs: 1,
		},
		{
			name:    "another amount",
			first:   apitest.OFXLine{Date: date, Amount: amount, Name: "PADARIA CENTRAL"},
			again:   apitest.OFXLine{Date: date, Amount: "-50.01", Name: "PADARIA CENTRAL"},
			want:    "received 1 ignored 0 matched 0 created 1 review 0",
			wantTxs: 2,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			h := apitest.New(t)
			account := h.Account("Bank", "asset", "checking", nil)
			mustImport(t, h, account, "ofx", "a.ofx", apitest.OFX("", tc.first))

			b := mustImport(t, h, account, "ofx", "b.ofx", apitest.OFX("", tc.again))

			if got := counts(b); got != tc.want {
				t.Fatalf("counts = %s, want %s", got, tc.want)
			}

			if got := transactionCount(t, h); got != tc.wantTxs {
				t.Fatalf("transactions = %d, want %d", got, tc.wantTxs)
			}
		})
	}
}

// S346 (A215): two distinct lines of one file both create, also when the file returns with a
// third; the owner settles a waiting line.
func TestS346DistinctLinesOfOneFile(t *testing.T) {
	t.Parallel()

	h := apitest.New(t)
	account := h.Account("Bank", "asset", "checking", nil)
	bakery := apitest.OFXLine{Date: "20261005", Amount: "-50.00", Name: "PADARIA"}
	market := apitest.OFXLine{Date: "20261005", Amount: "-50.00", Name: "MERCADO"}
	third := apitest.OFXLine{Date: "20261005", Amount: "-50.00", Name: "FARMACIA"}

	b := mustImport(t, h, account, "ofx", "a.ofx", apitest.OFX("", bakery, market))
	if got, want := counts(b), "received 2 ignored 0 matched 0 created 2 review 0"; got != want {
		t.Fatalf("first file = %s, want %s", got, want)
	}

	b = mustImport(t, h, account, "ofx", "b.ofx", apitest.OFX("", bakery, market, third))
	if got, want := counts(b), "received 3 ignored 2 matched 0 created 1 review 0"; got != want {
		t.Fatalf("second file = %s, want %s", got, want)
	}

	b = mustImport(t, h, account, "ofx", "c.ofx", apitest.OFX("", apitest.OFXLine{Date: "20261005", Amount: "-50.00", Name: "PADARIA LTDA"}))
	if got, want := counts(b), "received 1 ignored 0 matched 0 created 0 review 1"; got != want {
		t.Fatalf("third file = %s, want %s", got, want)
	}

	var record, reason string
	row := h.Pool.QueryRow(t.Context(), `SELECT id::text, review_reason FROM ingestion_external_record WHERE state = 'needs_review'`)

	if err := row.Scan(&record, &reason); err != nil {
		t.Fatal(err)
	}

	if reason != "duplicate" {
		t.Fatalf("reason = %s, want duplicate", reason)
	}

	h.MustDo(http.MethodPost, "/api/v1/external-records/"+record+"/resolve", map[string]any{"action": "discard"}, http.StatusOK, nil)

	if got := transactionCount(t, h); got != 3 {
		t.Fatalf("transactions = %d, want 3", got)
	}
}

// S347 (A215): a sync line repeating a line of a file batch waits; a line of an earlier sync
// under a new id follows its entry instead (A38).
func TestS347SyncLineRepeatsFileLine(t *testing.T) {
	t.Parallel()

	f := newSyncFixture(t)
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	mustImport(t, f.h, f.checking, "ofx", "a.ofx", apitest.OFX("", apitest.OFXLine{Date: "20261020", Amount: "-50.00", Name: "PADARIA"}))

	f.line(pluggy.SubtypeChecking, bankLine("s347-repeat", "2026-10-20", "-50.00"))
	f.line(pluggy.SubtypeChecking, bankLine("s347-synced", "2026-10-21", "-60.00"))
	f.sync()

	if state, tx := f.recordOf("s347-repeat"); state != "needs_review" || tx != "" {
		t.Fatalf("repeated line is %s with transaction %q, want needs_review", state, tx)
	}

	if got := transactionCount(t, f.h); got != 2 {
		t.Fatalf("transactions = %d, want 2", got)
	}

	f.p.RemoveTransaction(nubankItem+"-checking", "s347-synced")
	f.line(pluggy.SubtypeChecking, bankLine("s347-new-id", "2026-10-21", "-60.00"))
	f.p.SetItemUpdatedAt(nubankItem, "2026-11-12T15:00:00.000Z")
	f.sync()

	if state, tx := f.recordOf("s347-new-id"); state != "matched" || tx == "" {
		t.Fatalf("line under a new id is %s with transaction %q, want matched", state, tx)
	}
}
