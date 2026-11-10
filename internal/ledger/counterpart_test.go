package ledger_test

import (
	"errors"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type counterpartCase struct {
	name     string
	date     string
	amount   int64
	pending  bool
	usd      bool
	category bool
	manual   bool
	card     bool
	listed   bool
}

type counterpartSetup struct {
	h     *apitest.Harness
	a, b  string
	card  string
	usd   string
	gifts string
}

// S375: the counterparts of a sync line follow A216 rules 2.1 to 2.6.
func TestCounterparts(t *testing.T) {
	t.Parallel()

	tests := []counterpartCase{
		{name: "uncategorized in the window", date: "2026-11-07", amount: -25000, listed: true},
		{name: "outside the window", date: "2026-11-06", amount: -25000},
		{name: "another amount", date: "2026-11-10", amount: -25001},
		{name: "categorized", date: "2026-11-10", amount: -25000, category: true},
		{name: "pending", date: "2026-11-10", amount: -25000, pending: true},
		{name: "another currency", date: "2026-11-10", amount: -25000, usd: true},
		{name: "manual", date: "2026-11-10", amount: -25000, manual: true},
		{name: "reconciled card credit", date: "2026-11-10", amount: 25000, card: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			s := newCounterpartSetup(t)
			tx, record := s.candidate(t, tc)

			// A card credit has the opposite sign of a charge: its line is the debit.
			line := int64(25000)
			if tc.card {
				line = -25000
			}

			lineAmount, err := money.New(line, "BRL")
			if err != nil {
				t.Fatal(err)
			}

			got, err := s.h.App.Ledger.Counterparts(t.Context(), s.h.OwnerID(), ledger.CounterpartQuery{
				AccountID: uuid.MustParse(s.b), Amount: lineAmount, Date: day("2026-11-10"),
			})
			if err != nil {
				t.Fatal(err)
			}

			var want []ledger.Counterpart
			if tc.listed {
				want = []ledger.Counterpart{{TransactionID: tx, AccountID: uuid.MustParse(s.a), RecordID: record}}
			}

			if len(got) != len(want) || (len(want) == 1 && got[0] != want[0]) {
				t.Fatalf("counterparts = %+v, want %+v", got, want)
			}
		})
	}
}

// S375: pairing replaces the transit side with a posting that the record confirms.
func TestPairImported(t *testing.T) {
	t.Parallel()
	s := newCounterpartSetup(t)
	tx, _ := s.candidate(t, counterpartCase{date: "2026-11-07", amount: -25000})
	record := uuid.New()
	booksID := s.h.OwnerID()

	version, err := s.h.App.Ledger.PairImported(t.Context(), booksID, tx, uuid.MustParse(s.b), record)
	if err != nil {
		t.Fatal(err)
	}

	if version != 2 {
		t.Fatalf("version = %d, want 2", version)
	}

	view := s.h.Transaction(tx.String())
	if got := amountsByAccount(view); view.Version != 2 || len(view.Postings) != 2 || got[s.a] != -25000 || got[s.b] != 25000 {
		t.Fatalf("transaction = %+v", view)
	}

	if got, account := postingOfRecord(t, s.h, record); got != tx.String() || account != s.b {
		t.Fatalf("record on %s/%s", got, account)
	}

	_, err = s.h.App.Ledger.PairImported(t.Context(), booksID, tx, uuid.MustParse(s.b), uuid.New())
	if !errors.Is(err, ledger.ErrNotPairable) {
		t.Fatalf("second pairing error = %v, want ErrNotPairable", err)
	}
}

// S376: undo returns the paired transaction to the postings of the version before the pairing.
func TestUnpairImported(t *testing.T) {
	t.Parallel()
	s := newCounterpartSetup(t)
	tx, _ := s.candidate(t, counterpartCase{date: "2026-11-07", amount: -25000})
	record := uuid.New()
	booksID := s.h.OwnerID()

	version, err := s.h.App.Ledger.PairImported(t.Context(), booksID, tx, uuid.MustParse(s.b), record)
	if err != nil {
		t.Fatal(err)
	}

	if err := s.h.App.Ledger.UnpairImported(t.Context(), booksID, tx, record, version); err != nil {
		t.Fatal(err)
	}

	uncategorized := systemAccounts(s.h)["uncategorized_expense"]

	view := s.h.Transaction(tx.String())
	if got := amountsByAccount(view); view.Version != 3 || len(view.Postings) != 2 || got[s.a] != -25000 || got[uncategorized] != 25000 {
		t.Fatalf("transaction = %+v", view)
	}

	var linked int
	if err := s.h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM ledger_posting WHERE external_record_id = $1`, record).Scan(&linked); err != nil {
		t.Fatal(err)
	}

	if linked != 0 {
		t.Fatalf("postings linked to the record = %d, want 0", linked)
	}

	err = s.h.App.Ledger.UnpairImported(t.Context(), booksID, tx, record, version)
	if !errors.Is(err, ledger.ErrNotUnpairable) {
		t.Fatalf("second undo error = %v, want ErrNotUnpairable", err)
	}
}

// S376: a correction after the pairing leaves the transaction as the owner wrote it.
func TestUnpairImportedAfterCorrection(t *testing.T) {
	t.Parallel()
	s := newCounterpartSetup(t)
	tx, _ := s.candidate(t, counterpartCase{date: "2026-11-07", amount: -25000})
	record := uuid.New()
	booksID := s.h.OwnerID()

	version, err := s.h.App.Ledger.PairImported(t.Context(), booksID, tx, uuid.MustParse(s.b), record)
	if err != nil {
		t.Fatal(err)
	}

	correction := map[string]any{
		"date": "2026-11-07", "description": "Renamed", "expected_version": version, "reason": "typo",
		"postings": []any{apitest.Posting(s.a, -25000), apitest.Posting(s.b, 25000)},
	}
	s.h.MustDo(http.MethodPut, "/api/v1/transactions/"+tx.String(), correction, http.StatusOK, nil)

	err = s.h.App.Ledger.UnpairImported(t.Context(), booksID, tx, record, version)
	if !errors.Is(err, ledger.ErrNotUnpairable) {
		t.Fatalf("undo after correction error = %v, want ErrNotUnpairable", err)
	}
}

func newCounterpartSetup(t *testing.T) counterpartSetup {
	h := apitest.New(t, apitest.Today("2026-11-12"))

	return counterpartSetup{
		h:     h,
		a:     h.Account("A", "asset", "checking", nil),
		b:     h.Account("B", "asset", "checking", nil),
		card:  h.Card("Card", 3, 10, "next"),
		usd:   h.Account("A USD", "asset", "checking", map[string]any{"currency": "USD"}),
		gifts: h.Account("Gifts", "expense", "", nil),
	}
}

// candidate records the transaction of tc on account A, or on the account tc names, and
// returns its id and the id of the record that confirms its posting.
func (s counterpartSetup) candidate(t *testing.T, tc counterpartCase) (uuid.UUID, uuid.UUID) {
	t.Helper()

	if tc.manual {
		id := s.h.Record(tc.date, apitest.Posting(s.a, tc.amount), apitest.Posting(s.gifts, -tc.amount))

		return uuid.MustParse(id), uuid.Nil
	}

	if tc.usd {
		return s.foreignCandidate(t, tc)
	}

	account, currency := s.a, money.Currency("BRL")
	if tc.card {
		account = s.card
	}

	amount, err := money.New(tc.amount, currency)
	if err != nil {
		t.Fatal(err)
	}

	record := uuid.New()
	rec := ledger.ImportedRecord{
		RecordID: record,
		Posting: ledger.ImportedPosting{
			AccountID: uuid.MustParse(account), Date: day(tc.date), Amount: amount,
			Description: "Statement line", Pending: tc.pending,
		},
	}

	if tc.category {
		part := ledger.CategoryPart{AccountID: uuid.MustParse(s.gifts), Amount: amount.Neg()}
		rec.Decision = &ledger.ImportDecision{Parts: []ledger.CategoryPart{part}, Cause: ledger.Cause{Method: "rule", RuleID: uuid.New()}}
	}

	ids, err := s.h.App.Ledger.RecordImportedBatch(t.Context(), s.h.OwnerID(), []ledger.ImportedRecord{rec})
	if err != nil {
		t.Fatal(err)
	}

	if tc.card {
		if _, err := s.h.Pool.Exec(t.Context(), `UPDATE ledger_posting SET status = 'reconciled' WHERE external_record_id = $1`, record); err != nil {
			t.Fatal(err)
		}
	}

	return ids[0], record
}

// foreignCandidate records a transaction in USD, which the import path cannot book without a
// weight, and marks it as imported.
func (s counterpartSetup) foreignCandidate(t *testing.T, tc counterpartCase) (uuid.UUID, uuid.UUID) {
	t.Helper()

	usd := map[string]any{"amount": tc.amount, "currency": "USD"}
	id := s.h.Record(tc.date,
		map[string]any{"account_id": s.usd, "amount": usd, "weight": apitest.BRL(5 * tc.amount)},
		apitest.Posting(systemAccounts(s.h)["uncategorized_expense"], -5*tc.amount),
	)
	record := uuid.New()

	if _, err := s.h.Pool.Exec(t.Context(), `UPDATE ledger_transaction SET origin = 'import' WHERE id = $1`, id); err != nil {
		t.Fatal(err)
	}

	if _, err := s.h.Pool.Exec(t.Context(), `UPDATE ledger_posting SET external_record_id = $2 WHERE transaction_id = $1 AND account_id = $3`, id, record, s.usd); err != nil {
		t.Fatal(err)
	}

	return uuid.MustParse(id), record
}
