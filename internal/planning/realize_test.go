package planning_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// pay records a transaction on date from the fixture's checking account to counterpart and
// delivers the ledger events.
func (f fixture) pay(date string, amount int64, counterpart, payee string) string {
	f.h.T().Helper()
	body := map[string]any{
		"date": date, "description": "payment",
		"postings": []any{apitest.Posting(f.checking, -amount), apitest.Posting(counterpart, amount)},
	}
	if payee != "" {
		body["payee_id"] = payee
	}
	var out struct {
		ID string `json:"id"`
	}
	f.h.MustDo(http.MethodPost, "/api/v1/transactions", body, http.StatusCreated, &out)
	f.h.Dispatch()
	return out.ID
}

func (f fixture) rentSchedule() string {
	return f.schedule("bill", f.checking, f.rent, 210000, monthly("2026-11-01", 5, "following"), map[string]any{"payee_id": f.landlord})
}

func (f fixture) occurrence(scheduleID string, sequence int) occurrenceView {
	f.h.T().Helper()
	for _, o := range f.occurrences("from=2026-10-01&to=2027-09-30&schedule_id=" + scheduleID) {
		if o.Sequence == sequence {
			return o
		}
	}
	f.h.T().Fatalf("schedule %s has no occurrence %d", scheduleID, sequence)
	return occurrenceView{}
}

func TestPaymentOutsideToleranceStaysUnmatched(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	f.pay("2026-11-05", 235000, f.rent, f.landlord)
	if o := f.occurrence(id, 1); o.State != "expected" || o.TransactionID != "" {
		t.Fatalf("occurrence = %+v, want expected", o)
	}
}

func TestPaymentOutsideWindowStaysUnmatched(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	f.pay("2026-11-13", 210000, f.rent, f.landlord)
	if o := f.occurrence(id, 1); o.State != "expected" {
		t.Fatalf("occurrence = %+v, want expected", o)
	}
}

func TestPaymentWithAnotherPayeeStaysUnmatched(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	f.pay("2026-11-05", 210000, f.rent, "")
	if o := f.occurrence(id, 1); o.State != "expected" {
		t.Fatalf("occurrence = %+v, want expected", o)
	}
}

// A51: a transaction recorded on another category realizes once it is categorized.
func TestRealizedAfterCategorization(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	misc := f.h.Account("Misc", "expense", "", nil)
	tx := f.pay("2026-11-05", 210000, misc, f.landlord)
	if o := f.occurrence(id, 1); o.State != "expected" {
		t.Fatalf("before categorization = %+v", o)
	}
	f.h.MustDo(http.MethodPost, "/api/v1/transactions/"+tx+"/categorize", map[string]any{
		"expected_version": 1, "parts": []any{map[string]any{"account_id": f.rent, "amount": apitest.BRL(210000)}},
	}, http.StatusOK, nil)
	f.h.Dispatch()
	if o := f.occurrence(id, 1); o.State != "realized" || o.TransactionID != tx {
		t.Fatalf("after categorization = %+v", o)
	}
}

// Review Focus 2: one transaction that fits two occurrences realizes the closer one, once.
func TestTransactionFitsTwoOccurrences(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.schedule("bill", f.checking, f.rent, 10000, map[string]any{"frequency": "weekly", "interval": 1, "start": "2026-11-02"}, nil)
	tx := f.pay("2026-11-06", 10000, f.rent, "")
	f.h.Dispatch()
	for seq, want := range map[int]string{1: "expected", 2: "realized", 3: "expected"} {
		if o := f.occurrence(id, seq); o.State != want {
			t.Errorf("occurrence %d = %+v, want %s", seq, o, want)
		}
	}
	if o := f.occurrence(id, 2); o.TransactionID != tx {
		t.Errorf("occurrence 2 transaction = %q, want %q", o.TransactionID, tx)
	}
}

// Review Focus 4: voiding the realizing transaction returns the occurrence, which a later
// matching transaction realizes.
func TestVoidReleasesTheOccurrence(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	first := f.pay("2026-11-05", 210000, f.rent, f.landlord)
	f.h.MustDo(http.MethodPost, "/api/v1/transactions/"+first+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)
	f.h.Dispatch()
	f.h.Restart(apitest.Today("2026-11-09"))
	if o := f.occurrence(id, 1); o.State != "overdue" || o.TransactionID != "" {
		t.Fatalf("after void = %+v, want overdue", o)
	}
	second := f.pay("2026-11-09", 210000, f.rent, f.landlord)
	if o := f.occurrence(id, 1); o.State != "realized" || o.TransactionID != second {
		t.Fatalf("after the second payment = %+v", o)
	}
}

func TestManualRealization(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	tx := f.pay("2026-11-20", 150000, f.rent, "")
	occ := f.occurrence(id, 1)
	var got occurrenceView
	f.h.MustDo(http.MethodPost, "/api/v1/occurrences/"+occ.ID+"/realize", map[string]string{"transaction_id": tx}, http.StatusOK, &got)
	if got.State != "realized" || got.TransactionID != tx {
		t.Fatalf("realize = %+v", got)
	}
	// A correction that breaks the match keeps a manual realization.
	f.h.MustDo(http.MethodPut, "/api/v1/transactions/"+tx, map[string]any{
		"date": "2026-11-28", "description": "payment", "expected_version": 1, "reason": "date",
		"postings": []any{apitest.Posting(f.checking, -150000), apitest.Posting(f.rent, 150000)},
	}, http.StatusOK, nil)
	f.h.Dispatch()
	if o := f.occurrence(id, 1); o.State != "realized" || o.TransactionID != tx {
		t.Fatalf("after correction = %+v", o)
	}
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/occurrences/"+occ.ID+"/realize", map[string]string{"transaction_id": tx}), http.StatusConflict, "occurrence_closed", "")
	next := f.occurrence(id, 2)
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/occurrences/"+next.ID+"/realize", map[string]string{"transaction_id": tx}), http.StatusConflict, "transaction_in_use", "")
	misc := f.h.Account("Misc", "asset", "cash", nil)
	elsewhere := f.h.Record("2026-12-07", apitest.Posting(misc, -210000), apitest.Posting(f.rent, 210000))
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/occurrences/"+next.ID+"/realize", map[string]string{"transaction_id": elsewhere}), http.StatusUnprocessableEntity, "validation_failed", "transaction_id")

	var released occurrenceView
	f.h.MustDo(http.MethodPost, "/api/v1/occurrences/"+occ.ID+"/unrealize", nil, http.StatusOK, &released)
	if released.State != "expected" || released.TransactionID != "" {
		t.Fatalf("unrealize = %+v", released)
	}
	f.h.ExpectProblem(f.h.Do(http.MethodPost, "/api/v1/occurrences/"+occ.ID+"/unrealize", nil), http.StatusConflict, "occurrence_closed", "")
}

func TestRealizeOccurrenceOfAnotherUser(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	tx := f.pay("2026-11-20", 150000, f.rent, "")
	other := f.h.Login("other@example.com")
	r := f.h.Call(other, http.MethodPost, "/api/v1/occurrences/"+f.occurrence(id, 1).ID+"/realize", map[string]string{"transaction_id": tx})
	if r.Status != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", r.Status)
	}
}

// I07 under concurrency: a manual realization racing the automatic one for the same
// transaction is refused with 409 transaction_in_use, not a database error.
func TestManualRealizationRacingAutomaticIs409(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.rentSchedule()
	misc := f.h.Account("Misc", "expense", "", nil)
	tx := f.pay("2026-11-05", 210000, misc, f.landlord)
	november, december := f.occurrence(id, 1), f.occurrence(id, 2)

	ctx := t.Context()
	auto, err := f.h.Pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = auto.Rollback(ctx) }()
	if _, err := auto.Exec(ctx, `UPDATE planning_occurrence SET state = 'realized', transaction_id = $1, realized_by = 'auto' WHERE id = $2`, tx, november.ID); err != nil {
		t.Fatal(err)
	}

	done := make(chan apitest.Response, 1)
	go func() {
		done <- f.h.Do(http.MethodPost, "/api/v1/occurrences/"+december.ID+"/realize", map[string]any{"transaction_id": tx})
	}()
	// Only sessions on this test's database count: tests of other packages and of this one
	// run at once on the same server.
	for {
		var n int
		if err := f.h.Pool.QueryRow(ctx, `SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
			WHERE NOT l.granted AND a.datname = current_database()`).Scan(&n); err != nil {
			t.Fatalf("the manual realization never waited: %v", err)
		}
		if n > 0 {
			break
		}
	}
	if err := auto.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	f.h.ExpectProblem(<-done, http.StatusConflict, "transaction_in_use", "")
}
