package ingestion_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/pluggy"
)

// matching is a synced checking account with a category and payees whose aliases the lines
// resolve to (A99).
type matching struct {
	syncFixture
	transport string
	payees    map[string]string
}

func newMatching(t *testing.T, aliases map[string]string) matching {
	f := newSyncFixture(t)
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	m := matching{syncFixture: f, transport: f.h.Account("Transport", "expense", "", nil), payees: map[string]string{}}
	for name, pattern := range aliases {
		var payee struct {
			ID string `json:"id"`
		}
		f.h.MustDo(http.MethodPost, "/api/v1/payees", map[string]any{"name": name}, http.StatusCreated, &payee)
		f.h.MustDo(http.MethodPost, "/api/v1/payee-aliases", map[string]any{"pattern": pattern, "match_type": "contains", "payee_id": payee.ID}, http.StatusCreated, nil)
		m.payees[name] = payee.ID
	}
	return m
}

// manual records an owner's entry on the checking account.
func (m matching) manual(date string, amount int64, payee, description string) string {
	m.h.T().Helper()
	body := map[string]any{"date": date, "description": description, "postings": []map[string]any{
		apitest.Posting(m.checking, amount), apitest.Posting(m.transport, -amount),
	}}
	if payee != "" {
		body["payee_id"] = m.payees[payee]
	}
	var out struct {
		ID string `json:"id"`
	}
	m.h.MustDo(http.MethodPost, "/api/v1/transactions", body, http.StatusCreated, &out)
	return out.ID
}

func (m matching) lineOn(id, date, description string, amount pluggy.Decimal) {
	l := bankLine(id, date, amount)
	l.Description = description
	m.line(pluggy.SubtypeChecking, l)
}

type scoredView struct {
	ID               string   `json:"id"`
	State            string   `json:"state"`
	ReviewReason     string   `json:"review_reason"`
	Candidates       []string `json:"candidates"`
	ScoredCandidates []struct {
		TransactionID string `json:"transaction_id"`
		Score         int    `json:"score"`
		Amount        string `json:"amount"`
		Date          string `json:"date"`
		Counterparty  string `json:"counterparty"`
	} `json:"scored_candidates"`
}

func (m matching) inReview() []scoredView {
	m.h.T().Helper()
	var out struct {
		Items []scoredView `json:"items"`
	}
	m.h.MustDo(http.MethodGet, "/api/v1/import-batches/"+m.batches(m.checking)[0].ID+"/records?state=needs_review", nil, http.StatusOK, &out)
	return out.Items
}

// S91 (A99, A100): an identical amount on the same day with the same payee links the line to
// the owner's entry, which keeps its category.
func TestS91ManualEntryLinks(t *testing.T) {
	t.Parallel()
	m := newMatching(t, map[string]string{"Uber": "Uberrides"})
	entry := m.manual("2026-10-20", -712, "Uber", "Uber")
	m.lineOn("uber-1", "2026-10-20", "Dl *Uberrides", "-7.12")
	m.sync()

	if state, tx := m.recordOf("uber-1"); state != "matched" || tx != entry {
		t.Fatalf("record = %s on %s, want matched on %s", state, tx, entry)
	}
	got := m.h.Transaction(entry)
	if len(got.Postings) != 2 || got.Postings[1].AccountID != m.transport {
		t.Fatalf("entry = %+v", got)
	}
}

// S93 (A100): two entries of the same payee and amount two days apart are ambiguous; the
// review lists both, best first, with their scores.
func TestS93TwoRidesAreAmbiguous(t *testing.T) {
	t.Parallel()
	m := newMatching(t, map[string]string{"Uber": "Uberrides"})
	older := m.manual("2026-10-18", -712, "Uber", "Uber")
	same := m.manual("2026-10-20", -712, "Uber", "Uber")
	m.lineOn("uber-1", "2026-10-20", "Dl *Uberrides", "-7.12")
	m.sync()

	queued := m.inReview()
	if len(queued) != 1 || queued[0].ReviewReason != "ambiguous" || !slices.Equal(queued[0].Candidates, []string{same, older}) {
		t.Fatalf("review = %+v", queued)
	}
	s := queued[0].ScoredCandidates
	if len(s) != 2 || s[0].Score != 13 || s[1].Score != 12 || s[1].Date != "near" || s[0].Counterparty != "same_payee" {
		t.Fatalf("scored candidates = %+v", s)
	}
}

// S94 (A99): an identical amount on the same day with another payee is a new transaction.
func TestS94OtherPayeeIsNew(t *testing.T) {
	t.Parallel()
	m := newMatching(t, map[string]string{"Drogasil": "DROGASIL", "iFood": "IFOOD"})
	entry := m.manual("2026-10-20", -4590, "Drogasil", "Farmácia")
	m.lineOn("ifood-1", "2026-10-20", "IFOOD *Restaurante", "-45.90")
	m.sync()

	if state, tx := m.recordOf("ifood-1"); state != "created" || tx == entry {
		t.Fatalf("record = %s on %s, want a new transaction", state, tx)
	}
}

// S95 (A98, A99): an entry seven days before its line, with the same payee and amount, links.
func TestS95HotelSevenDaysApartLinks(t *testing.T) {
	t.Parallel()
	m := newMatching(t, map[string]string{"Ibis": "IBIS"})
	entry := m.manual("2026-10-10", -80000, "Ibis", "Hotel")
	m.lineOn("hotel-1", "2026-10-17", "HOTEL IBIS", "-800.00")
	m.sync()

	if state, tx := m.recordOf("hotel-1"); state != "matched" || tx != entry {
		t.Fatalf("record = %s on %s, want matched on %s", state, tx, entry)
	}
}

// S92 (A100, A101): a manual entry of another amount on the same day is probable; matching
// it corrects the entry to the line's amount in a new version and keeps its category.
func TestS92ProbableMatchTakesTheLineAmount(t *testing.T) {
	t.Parallel()
	m := newMatching(t, map[string]string{"Uber": "Uberrides"})
	entry := m.manual("2026-10-20", -700, "Uber", "Uber")
	m.lineOn("uber-1", "2026-10-20", "Dl *Uberrides", "-7.12")
	m.sync()

	queued := m.inReview()
	if len(queued) != 1 || queued[0].ReviewReason != "probable" || len(queued[0].ScoredCandidates) != 1 ||
		queued[0].ScoredCandidates[0].Score != 5 || queued[0].ScoredCandidates[0].Amount != "bounded" {
		t.Fatalf("review = %+v", queued)
	}
	m.h.MustDo(http.MethodPost, "/api/v1/external-records/"+queued[0].ID+"/resolve",
		map[string]any{"action": "match", "transaction_id": entry}, http.StatusOK, nil)

	got := m.h.Transaction(entry)
	amounts := map[string]int64{}
	for _, p := range got.Postings {
		amounts[p.AccountID] = p.Amount.Amount
	}
	if got.Version != 2 || amounts[m.checking] != -712 || amounts[m.transport] != 712 || got.Description != "Uber" {
		t.Fatalf("entry after the match = %+v", got)
	}
	if state, tx := m.recordOf("uber-1"); state != "matched" || tx != entry {
		t.Fatalf("record = %s on %s", state, tx)
	}
}

// Review Focus 3: a candidate voided while the record waits for review cannot be matched.
func TestResolveRefusesAVoidedCandidate(t *testing.T) {
	t.Parallel()
	m := newMatching(t, map[string]string{"Uber": "Uberrides"})
	entry := m.manual("2026-10-20", -700, "Uber", "Uber")
	m.lineOn("uber-1", "2026-10-20", "Dl *Uberrides", "-7.12")
	m.sync()
	queued := m.inReview()
	m.h.MustDo(http.MethodPost, "/api/v1/transactions/"+entry+"/void", map[string]string{"reason": "typo"}, http.StatusOK, nil)

	r := m.h.Do(http.MethodPost, "/api/v1/external-records/"+queued[0].ID+"/resolve", map[string]any{"action": "match", "transaction_id": entry})
	m.h.ExpectProblem(r, http.StatusConflict, "transaction_voided", "")
}

// A101: an entry reconciled while its record waits for review keeps its amount; matching it
// is refused with posting_reconciled.
func TestResolveRefusesAReconciledCandidate(t *testing.T) {
	t.Parallel()
	m := newMatching(t, map[string]string{"Uber": "Uberrides"})
	entry := m.manual("2026-10-20", -700, "Uber", "Uber")
	m.lineOn("uber-1", "2026-10-20", "Dl *Uberrides", "-7.12")
	m.sync()
	queued := m.inReview()
	m.h.MustDo(http.MethodPost, "/api/v1/accounts/"+m.checking+"/balance-assertions",
		map[string]any{"date": "2026-10-20", "amount": apitest.BRL(-700)}, http.StatusCreated, nil)
	if p := m.h.Transaction(entry).Postings[0]; p.Status != "reconciled" {
		t.Fatalf("entry posting = %+v, want reconciled", p)
	}

	r := m.h.Do(http.MethodPost, "/api/v1/external-records/"+queued[0].ID+"/resolve", map[string]any{"action": "match", "transaction_id": entry})
	m.h.ExpectProblem(r, http.StatusConflict, "posting_reconciled", "")
}

// S96 (A102): a linked line whose amount or date changes corrects its transaction; on a
// reconciled posting the ledger keeps its amount, and the record describes the change with
// review reason changed.
func TestS96LineChangesAfterTheMatch(t *testing.T) {
	t.Parallel()
	m := newMatching(t, map[string]string{"Uber": "Uberrides"})
	entry := m.manual("2026-10-20", -712, "Uber", "Uber")
	m.lineOn("uber-1", "2026-10-20", "Dl *Uberrides", "-7.12")
	m.sync()
	m.lineOn("uber-1", "2026-10-21", "Dl *Uberrides", "-7.15")
	m.p.SetItemUpdatedAt(nubankItem, "2026-11-12T09:00:00.000Z")
	m.sync()

	got := m.h.Transaction(entry)
	if got.Version != 2 || got.Date != "2026-10-21" || got.Postings[0].Amount.Amount != -715 || got.Postings[1].Amount.Amount != 715 {
		t.Fatalf("entry after the change = %+v", got)
	}

	m.h.MustDo(http.MethodPost, "/api/v1/accounts/"+m.checking+"/balance-assertions",
		map[string]any{"date": "2026-10-21", "amount": apitest.BRL(-715)}, http.StatusCreated, nil)
	m.lineOn("uber-1", "2026-10-21", "Dl *Uberrides", "-7.30")
	m.p.SetItemUpdatedAt(nubankItem, "2026-11-12T10:00:00.000Z")
	m.sync()
	if got := m.h.Transaction(entry); got.Version != 2 || got.Postings[0].Amount.Amount != -715 {
		t.Fatalf("reconciled entry = %+v", got)
	}
	if rec := m.record("uber-1"); rec.State != "matched" || rec.ReviewReason != "changed" || rec.UnappliedChange == "" {
		t.Fatalf("record = %+v", rec)
	}
}

type changedView struct {
	ExternalID      string `json:"external_id"`
	State           string `json:"state"`
	ReviewReason    string `json:"review_reason"`
	UnappliedChange string `json:"unapplied_change"`
}

// record finds the record of an aggregator line among the records of the account's batches.
func (m matching) record(externalID string) changedView {
	m.h.T().Helper()
	for _, b := range m.batches(m.checking) {
		var out struct {
			Items []changedView `json:"items"`
		}
		m.h.MustDo(http.MethodGet, "/api/v1/import-batches/"+b.ID+"/records", nil, http.StatusOK, &out)
		for _, r := range out.Items {
			if r.ExternalID == externalID {
				return r
			}
		}
	}
	m.h.T().Fatalf("no record %s", externalID)
	return changedView{}
}

// S97 (A103): entries of a synced account that no line confirmed, dated more than 10 days
// before its last synced date and on or after the mapping's start, are listed oldest first.
func TestS97UnconfirmedEntries(t *testing.T) {
	t.Parallel()
	m := newMatching(t, map[string]string{"Uber": "Uberrides"})
	m.manual("2026-09-20", -1000, "", "before the mapping")
	forgotten := m.manual("2026-10-05", -3000, "", "Cinema")
	m.manual("2026-11-05", -2000, "", "within ten days")
	m.manual("2026-10-08", -712, "Uber", "Uber")
	m.lineOn("uber-1", "2026-10-08", "Dl *Uberrides", "-7.12")
	m.sync()

	var out struct {
		Items []struct {
			TransactionID string `json:"transaction_id"`
			Date          string `json:"date"`
			Description   string `json:"description"`
			Amount        struct {
				Amount int64 `json:"amount"`
			} `json:"amount"`
		} `json:"items"`
	}
	m.h.MustDo(http.MethodGet, "/api/v1/accounts/"+m.checking+"/unconfirmed", nil, http.StatusOK, &out)
	if len(out.Items) != 1 || out.Items[0].TransactionID != forgotten || out.Items[0].Date != "2026-10-05" ||
		out.Items[0].Amount.Amount != -3000 || out.Items[0].Description != "Cinema" {
		t.Fatalf("unconfirmed = %+v", out.Items)
	}
	cash := m.h.Account("Wallet", "asset", "cash", nil)
	m.h.Record("2026-10-01", apitest.Posting(cash, -500), apitest.Posting(m.transport, 500))
	m.h.MustDo(http.MethodGet, "/api/v1/accounts/"+cash+"/unconfirmed", nil, http.StatusOK, &out)
	if len(out.Items) != 0 {
		t.Fatalf("an account without lines from an institution lists %+v", out.Items)
	}
}
