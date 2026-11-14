package ledger_test

import (
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const corporateActionsPath = "/api/v1/corporate-actions"

type actionOut struct {
	Kind      string         `json:"kind"`
	RatioFrom int64          `json:"ratio_from"`
	RatioTo   int64          `json:"ratio_to"`
	Held      map[string]any `json:"held"`
	Received  map[string]any `json:"received"`
	Fraction  string         `json:"fraction"`
	UnitCost  string         `json:"unit_cost"`
	Value     map[string]any `json:"value"`
}

type actionTx struct {
	ID              string       `json:"id"`
	Version         int          `json:"version"`
	Postings        []postingOut `json:"postings"`
	CorporateAction *actionOut   `json:"corporate_action"`
}

func TestS431Split(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})

	tx := f.recordAction(t, "split", "2026-11-10", 1, 10, nil)

	expectPostings(
		t,
		tx.Postings,
		[3]any{f.petr4, int64(-100), int64(-100000)},
		[3]any{f.petr4, int64(1000), int64(100000)},
	)

	var read actionTx
	f.h.MustDo(http.MethodGet, "/api/v1/transactions/"+tx.ID, nil, http.StatusOK, &read)

	a := read.CorporateAction
	if a == nil || a.Kind != "split" || a.RatioFrom != 1 || a.RatioTo != 10 ||
		a.Held["amount"] != float64(100) || a.Received["amount"] != float64(1000) ||
		a.Fraction != "0" || a.Value["amount"] != float64(0) {
		t.Fatalf("detail = %+v", a)
	}

	f.h.ExpectProblem(
		f.h.Do(http.MethodPut, "/api/v1/transactions/"+tx.ID, map[string]any{
			"expected_version": tx.Version,
			"date":             "2026-11-10",
			"reason":           "typo",
			"postings": []map[string]any{
				apitest.Posting(f.nubank, 100),
				apitest.Posting(f.travel, -100),
			},
		}),
		http.StatusConflict, "investment_transaction", "",
	)
}

func TestRecategorizedBonusKeepsItsDetailInVersions(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	bonuses := f.h.Account("Bonificações", "income", "", nil)
	other := f.h.Account("Other income", "income", "", nil)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})
	tx := f.recordAction(t, "bonus", "2026-11-10", 10, 11, map[string]any{
		"unit_cost":   "5.00",
		"category_id": bonuses,
	})

	f.h.MustDo(
		http.MethodPost,
		"/api/v1/transactions/"+tx.ID+"/categorize",
		map[string]any{
			"expected_version": tx.Version,
			"parts":            []map[string]any{part(other, -5000)},
		},
		http.StatusOK,
		nil,
	)

	var versions struct {
		Items []struct {
			Version     int      `json:"version"`
			Transaction actionTx `json:"transaction"`
		} `json:"items"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/transactions/"+tx.ID+"/versions",
		nil,
		http.StatusOK,
		&versions,
	)

	if len(versions.Items) != 1 || versions.Items[0].Version != 1 {
		t.Fatalf("versions = %+v", versions)
	}

	a := versions.Items[0].Transaction.CorporateAction
	if a == nil || a.Kind != "bonus" || a.RatioFrom != 10 || a.RatioTo != 11 ||
		a.Held["amount"] != float64(100) || a.Received["amount"] != float64(110) ||
		a.Value["amount"] != float64(5000) {
		t.Fatalf("detail = %+v", a)
	}
}

func TestS432ReverseSplit(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(
		t,
		"2026-11-01",
		map[string]any{"quantity": units(15, "PETR4"), "unit_price": "10.00"},
	)

	tx := f.recordAction(t, "reverse_split", "2026-11-10", 10, 1, nil)

	expectPostings(
		t,
		tx.Postings,
		[3]any{f.petr4, int64(-15), int64(-15000)},
		[3]any{f.petr4, int64(1), int64(15000)},
	)

	var read actionTx
	f.h.MustDo(http.MethodGet, "/api/v1/transactions/"+tx.ID, nil, http.StatusOK, &read)

	if read.CorporateAction == nil || read.CorporateAction.Fraction != "0.5" {
		t.Fatalf("detail = %+v", read.CorporateAction)
	}
}

func TestS433Bonus(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	bonuses := f.h.Account("Bonificações", "income", "", nil)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})

	tx := f.recordAction(t, "bonus", "2026-11-10", 10, 11, map[string]any{
		"unit_cost":   "5.00",
		"category_id": bonuses,
	})

	expectPostings(
		t,
		tx.Postings,
		[3]any{f.petr4, int64(-100), int64(-100000)},
		[3]any{f.petr4, int64(110), int64(105000)},
		[3]any{bonuses, int64(-5000), int64(-5000)},
	)

	a := tx.CorporateAction
	if a == nil || a.UnitCost != "5" && a.UnitCost != "5.00" ||
		a.Value["amount"] != float64(5000) || a.Received["amount"] != float64(110) {
		t.Fatalf("detail = %+v", a)
	}

	f.h.ExpectProblem(
		f.h.Do(http.MethodPost, corporateActionsPath, f.actionBody("bonus", "2026-11-11", 10, 11,
			map[string]any{"unit_cost": "5.00", "category_id": f.travel})),
		http.StatusUnprocessableEntity, "validation_failed", "category_id",
	)
}

func TestS434ActionBeforeALaterSale(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", nil)
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/trades",
		f.petr4Order("2026-11-12", map[string]any{"side": "sell", "unit_price": "31.00"}),
		http.StatusCreated,
		nil,
	)

	f.h.ExpectProblem(
		f.h.Do(
			http.MethodPost,
			corporateActionsPath,
			f.actionBody("split", "2026-11-10", 1, 10, nil),
		),
		http.StatusConflict,
		"later_sale_exists",
		"",
	)
}

func TestS435ActionWithoutHolding(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-10", nil)

	f.h.ExpectProblem(
		f.h.Do(
			http.MethodPost,
			corporateActionsPath,
			f.actionBody("split", "2026-11-10", 1, 10, nil),
		),
		http.StatusUnprocessableEntity,
		"validation_failed",
		"account_id",
	)
}

func TestActionHoldsTheDayBefore(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", nil)
	f.buyPETR4(t, "2026-11-10", map[string]any{"quantity": units(10, "PETR4")})

	tx := f.recordAction(t, "split", "2026-11-10", 1, 10, nil)

	expectPostings(
		t,
		tx.Postings,
		[3]any{f.petr4, int64(-100), int64(-300000)},
		[3]any{f.petr4, int64(1000), int64(300000)},
	)
}

func TestActionNamesOneBrokerageHolding(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", nil)

	body := f.actionBody("split", "2026-11-10", 1, 10, nil)
	delete(body, "account_id")
	body["brokerage_id"], body["instrument"] = f.xp, "PETR4"

	var tx actionTx
	f.h.MustDo(http.MethodPost, corporateActionsPath, body, http.StatusCreated, &tx)

	expectPostings(
		t,
		tx.Postings,
		[3]any{f.petr4, int64(-100), int64(-300000)},
		[3]any{f.petr4, int64(1000), int64(300000)},
	)

	f.h.MustDo(
		http.MethodPost,
		"/api/v1/instruments",
		security("VALE3", "stock"),
		http.StatusCreated,
		nil,
	)

	body["instrument"] = "VALE3"
	f.h.ExpectProblem(
		f.h.Do(http.MethodPost, corporateActionsPath, body),
		http.StatusUnprocessableEntity, "holding_not_found", "",
	)
}

func TestCorporateActionRoles(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", nil)
	owner := f.h.OwnerID()

	reader := f.h.JoinAs("reader@example.com", owner, "read")
	f.h.ExpectProblem(
		f.h.Call(reader, http.MethodPost, corporateActionsPath,
			f.actionBody("split", "2026-11-10", 1, 10, nil)),
		http.StatusForbidden, "book_role_required", "",
	)

	outsider := f.h.LoginMember("outsider@example.com")
	f.h.ExpectProblem(
		f.h.Call(outsider, http.MethodPost, corporateActionsPath,
			f.actionBody("split", "2026-11-10", 1, 10, nil)),
		http.StatusUnprocessableEntity, "invalid_account", "account_id",
	)

	writer := f.h.JoinAs("write-user@example.com", owner, "write")
	if r := f.h.Call(writer, http.MethodPost, corporateActionsPath,
		f.actionBody("split", "2026-11-10", 1, 10, nil)); r.Status != http.StatusCreated {
		t.Fatalf("write status = %d: %s", r.Status, r.Body)
	}
}

func (f investFixture) recordAction(
	t *testing.T,
	kind, date string,
	from, to int64,
	extra map[string]any,
) actionTx {
	t.Helper()

	var out actionTx
	f.h.MustDo(
		http.MethodPost,
		corporateActionsPath,
		f.actionBody(kind, date, from, to, extra),
		http.StatusCreated,
		&out,
	)

	return out
}

func (f investFixture) actionBody(
	kind, date string,
	from, to int64,
	extra map[string]any,
) map[string]any {
	body := map[string]any{
		"account_id": f.petr4,
		"kind":       kind,
		"date":       date,
		"ratio_from": from,
		"ratio_to":   to,
	}
	for k, v := range extra {
		body[k] = v
	}

	return body
}
