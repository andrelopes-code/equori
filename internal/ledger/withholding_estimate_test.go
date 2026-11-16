package ledger_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"
)

type withholdingOut struct {
	IncomeTax map[string]any `json:"income_tax"`
	IOF       map[string]any `json:"iof"`
	Net       map[string]any `json:"net"`
}

func (f lotFixture) withholding(
	t *testing.T,
	date string,
	quantity, proceeds int64,
) withholdingOut {
	t.Helper()

	var out withholdingOut
	f.h.MustDo(
		http.MethodGet,
		f.withholdingPath(date, quantity, proceeds),
		nil,
		http.StatusOK,
		&out,
	)

	return out
}

func (f lotFixture) withholdingPath(date string, quantity, proceeds int64) string {
	return fmt.Sprintf(
		"/api/v1/accounts/%s/withholding?date=%s&quantity=%d&proceeds=%d",
		f.account, date, quantity, proceeds,
	)
}

func expectWithholding(t *testing.T, got withholdingOut, incomeTax, iof, net int64) {
	t.Helper()

	if got.IncomeTax["amount"] != float64(incomeTax) || got.IOF["amount"] != float64(iof) ||
		got.Net["amount"] != float64(net) {
		t.Fatalf("withholding = %+v, want income tax %d, IOF %d, net %d", got, incomeTax, iof, net)
	}
}

// S460 (FS-S5): a gain of 100.00 redeemed after 10 days pays IOF 66.00 and income tax 7.65.
func TestWithholdingOfAnEarlyRedemption(t *testing.T) {
	t.Parallel()
	f := newLotFixtureOf(t, "TDX", "fixed_income", "cdb")
	f.trade(t, "buy", "2026-03-01", 100, "10.00")

	expectWithholding(t, f.withholding(t, "2026-03-11", 100, 110000), 765, 6600, 102635)
}

// S461 (FS-S6): each lot takes the rate of its own holding period.
func TestWithholdingByLot(t *testing.T) {
	t.Parallel()

	sale := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	f := newLotFixtureOf(t, "TDX", "fixed_income", "cdb")
	f.trade(t, "buy", sale.AddDate(0, 0, -400).Format(time.DateOnly), 60, "10.00")
	f.trade(t, "buy", sale.AddDate(0, 0, -200).Format(time.DateOnly), 40, "12.50")

	expectWithholding(t, f.withholding(t, "2026-06-01", 100, 130000), 3550, 0, 126450)
}

// S462 (FS-S7): a sale at a loss pays no tax.
func TestWithholdingOfALoss(t *testing.T) {
	t.Parallel()
	f := newLotFixtureOf(t, "TDX", "fixed_income", "")
	f.trade(t, "buy", "2026-03-01", 100, "10.00")

	expectWithholding(t, f.withholding(t, "2026-03-11", 100, 90000), 0, 0, 90000)
}

// S463 (FS-S8): a stock, an exempt security and a book outside Brazil have no estimate.
func TestWithholdingNeedsATaxedFixedIncomeSecurity(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct{ code, kind, subtype string }{
		{"TDS", "stock", ""},
		{"TDL", "fixed_income", "lci"},
	} {
		f := newLotFixtureOf(t, tc.code, tc.kind, tc.subtype)
		f.trade(t, "buy", "2026-03-01", 100, "10.00")

		f.h.ExpectProblem(
			f.h.Do(http.MethodGet, f.withholdingPath("2026-03-11", 100, 110000), nil),
			http.StatusUnprocessableEntity, "validation_failed", "id",
		)
	}
}

// S464 (FS-S9): the roles that read, and a member of another book.
func TestWithholdingRoles(t *testing.T) {
	t.Parallel()
	f := newLotFixtureOf(t, "TDX", "fixed_income", "cdb")
	f.trade(t, "buy", "2026-03-01", 100, "10.00")

	path := f.withholdingPath("2026-03-11", 100, 110000)
	owner := f.h.OwnerID()

	for role, user := range map[string]string{"read": "wh-reader@example.com", "write": "wh-writer@example.com"} {
		client := f.h.JoinAs(user, owner, role)
		if r := f.h.Call(client, http.MethodGet, path, nil); r.Status != http.StatusOK {
			t.Fatalf("%s status = %d: %s", role, r.Status, r.Body)
		}
	}

	outsider := f.h.LoginMember("wh-outsider@example.com")
	if r := f.h.Call(outsider, http.MethodGet, path, nil); r.Status != http.StatusNotFound {
		t.Fatalf("outsider status = %d: %s", r.Status, r.Body)
	}
}

// S465 (FS6): the assistant tool estimate_redemption returns the same estimate as S460.
func TestEstimateRedemptionTool(t *testing.T) {
	t.Parallel()
	f := newLotFixtureOf(t, "TDX", "fixed_income", "cdb")
	f.trade(t, "buy", "2026-03-01", 100, "10.00")

	r := f.h.Tool("estimate_redemption", map[string]any{
		"account_id": f.account, "date": "2026-03-11", "quantity": "100", "proceeds": "1100.00",
	})

	var got struct {
		IncomeTax struct{ Amount string } `json:"income_tax"`
		IOF       struct{ Amount string } `json:"iof"`
		Net       struct{ Amount string } `json:"net"`
	}
	if err := json.Unmarshal(r.Content, &got); err != nil {
		t.Fatalf("content %s: %v", r.Content, err)
	}

	if got.IncomeTax.Amount != "7.65" || got.IOF.Amount != "66.00" || got.Net.Amount != "1026.35" {
		t.Fatalf("estimate = %+v (%s)", got, r.Content)
	}

	f.h.ExpectToolError(
		f.h.Tool("estimate_redemption", map[string]any{
			"account_id": f.account, "date": "2026-03-11", "quantity": "101", "proceeds": "1100.00",
		}),
		"validation_failed", "quantity",
	)
}
