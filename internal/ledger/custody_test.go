package ledger_test

import (
	"net/http"
	"testing"
)

const custodyPath = "/api/v1/custody-transfers"

type positionOut struct {
	AccountID string         `json:"account_id"`
	Quantity  map[string]any `json:"quantity"`
	Cost      map[string]any `json:"cost_basis"`
}

func TestS436CustodyTransfer(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})
	brokerageB := f.h.Account("Corretora B", "asset", "brokerage", nil)
	f.h.Account("Corretora B cash", "asset", "brokerage", map[string]any{"parent_id": brokerageB})

	var tx actionTx
	f.h.MustDo(
		http.MethodPost,
		custodyPath,
		f.custodyBody(brokerageB, "2026-11-10", 40),
		http.StatusCreated,
		&tx,
	)

	holdingB := tx.Postings[1].AccountID

	var created struct {
		ParentID string `json:"parent_id"`
		Currency string `json:"currency"`
	}
	f.h.MustDo(http.MethodGet, "/api/v1/accounts/"+holdingB, nil, http.StatusOK, &created)

	if created.ParentID != brokerageB || created.Currency != "PETR4" {
		t.Fatalf("receiving holding = %+v", created)
	}

	expectPostings(
		t,
		tx.Postings,
		[3]any{f.petr4, int64(-40), int64(-40000)},
		[3]any{holdingB, int64(40), int64(40000)},
	)

	f.h.Dispatch()

	var positions struct {
		Items []positionOut `json:"items"`
	}
	f.h.MustDo(
		http.MethodGet,
		"/api/v1/positions?date=2026-11-10",
		nil,
		http.StatusOK,
		&positions,
	)

	want := map[string][2]float64{f.petr4: {60, 60000}, holdingB: {40, 40000}}
	if len(positions.Items) != len(want) {
		t.Fatalf("positions = %+v", positions.Items)
	}

	for _, p := range positions.Items {
		w, ok := want[p.AccountID]
		if !ok || p.Quantity["amount"] != w[0] || p.Cost["amount"] != w[1] {
			t.Fatalf("position = %+v, want %v", p, w)
		}
	}
}

func TestS437CustodyTransferLimits(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})
	brokerageB := f.h.Account("Corretora B", "asset", "brokerage", nil)

	f.h.ExpectProblem(
		f.h.Do(http.MethodPost, custodyPath, f.custodyBody(brokerageB, "2026-11-10", 101)),
		http.StatusUnprocessableEntity, "validation_failed", "quantity",
	)
	f.h.ExpectProblem(
		f.h.Do(http.MethodPost, custodyPath, f.custodyBody(f.xp, "2026-11-10", 40)),
		http.StatusUnprocessableEntity, "validation_failed", "brokerage_id",
	)
}

func TestCustodyTransferBeforeALaterSale(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})
	brokerageB := f.h.Account("Corretora B", "asset", "brokerage", nil)
	f.h.MustDo(
		http.MethodPost,
		"/api/v1/trades",
		f.petr4Order("2026-11-10", map[string]any{
			"side": "sell", "quantity": units(10, "PETR4"), "unit_price": "11.00",
		}),
		http.StatusCreated,
		nil,
	)

	f.h.ExpectProblem(
		f.h.Do(http.MethodPost, custodyPath, f.custodyBody(brokerageB, "2026-11-10", 40)),
		http.StatusConflict, "later_sale_exists", "",
	)
}

func TestCustodyTransferRoles(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})
	brokerageB := f.h.Account("Corretora B", "asset", "brokerage", nil)
	body := f.custodyBody(brokerageB, "2026-11-10", 10)
	owner := f.h.OwnerID()

	reader := f.h.JoinAs("reader@example.com", owner, "read")
	f.h.ExpectProblem(
		f.h.Call(reader, http.MethodPost, custodyPath, body),
		http.StatusForbidden, "book_role_required", "",
	)

	outsider := f.h.LoginMember("outsider@example.com")
	f.h.ExpectProblem(
		f.h.Call(outsider, http.MethodPost, custodyPath, body),
		http.StatusUnprocessableEntity, "invalid_account", "account_id",
	)

	writer := f.h.JoinAs("write-user@example.com", owner, "write")
	if r := f.h.Call(writer, http.MethodPost, custodyPath, body); r.Status != http.StatusCreated {
		t.Fatalf("write status = %d: %s", r.Status, r.Body)
	}
}

// A custody transfer without a description takes the ledger's wording in the book's language
// (A228 IO31); a description given is kept.
func TestCustodyTransferDescription(t *testing.T) {
	t.Parallel()
	f := newInvestFixture(t)
	f.buyPETR4(t, "2026-11-01", map[string]any{"unit_price": "10.00"})
	brokerageB := f.h.Account("Corretora B", "asset", "brokerage", nil)
	f.h.Account("Corretora B cash", "asset", "brokerage", map[string]any{"parent_id": brokerageB})

	for _, tc := range []struct {
		name, given, want string
	}{
		{"wording", "", "Transferência de custódia de PETR4"},
		{"given", "Portabilidade", "Portabilidade"},
	} {
		body := f.custodyBody(brokerageB, "2026-11-10", 10)
		if tc.given != "" {
			body["description"] = tc.given
		}

		var tx struct {
			Description string `json:"description"`
		}

		f.h.MustDo(http.MethodPost, custodyPath, body, http.StatusCreated, &tx)

		if tx.Description != tc.want {
			t.Errorf("%s: description = %q, want %q", tc.name, tx.Description, tc.want)
		}
	}
}

func (f investFixture) custodyBody(brokerage, date string, quantity int64) map[string]any {
	return map[string]any{
		"account_id":   f.petr4,
		"brokerage_id": brokerage,
		"date":         date,
		"quantity":     units(quantity, "PETR4"),
	}
}
