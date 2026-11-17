package ingestion_test

import (
	"net/http"
	"testing"

	pluggy "github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy/client"
)

type investmentMovementView struct {
	ID           string `json:"id"`
	InvestmentID string `json:"investment_id"`
	Kind         string `json:"kind"`
	Date         string `json:"date"`
	Amount       struct {
		Amount   int64  `json:"amount"`
		Currency string `json:"currency"`
	} `json:"amount"`
	State         string `json:"state"`
	Proposal      string `json:"proposal"`
	TransactionID string `json:"transaction_id"`
}

type investmentView struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Type             string `json:"type"`
	Subtype          string `json:"subtype"`
	Issuer           string `json:"issuer"`
	IndexID          string `json:"index_id"`
	PercentOfIndexBP int    `json:"percent_of_index_bp"`
	SpreadBP         int    `json:"spread_bp"`
	HasTerms         bool   `json:"has_terms"`
	MaturesOn        string `json:"matures_on"`
	Balance          struct {
		Amount   int64  `json:"amount"`
		Currency string `json:"currency"`
	} `json:"balance"`
	BalanceDate string                   `json:"balance_date"`
	Instrument  string                   `json:"instrument"`
	Movements   []investmentMovementView `json:"movements"`
}

// cdbItem serves a CDB at 110% of the CDI with a buy and an interest movement.
func (f syncFixture) cdbItem() {
	f.p.AddInvestment(nubankItem, f.cdb("1050.00", "2026-11-10"))
	f.p.AddInvestmentTransaction("inv-cdb", pluggy.InvestmentTransaction{
		ID: "m-buy", Type: "BUY", Date: "2026-01-10T00:00:00.000Z", Quantity: "1000",
		Amount: "1000.00",
	})
	f.p.AddInvestmentTransaction("inv-cdb", pluggy.InvestmentTransaction{
		ID: "m-interest", Type: "INTEREST", Date: "2026-10-01T00:00:00.000Z", Amount: "50.00",
	})
}

func (f syncFixture) cdb(balance, date string) pluggy.Investment {
	due := "2028-01-10T00:00:00.000Z"

	return pluggy.Investment{
		ID: "inv-cdb", Type: "FIXED_INCOME", Subtype: "CDB", Name: "CDB Bank 110",
		CurrencyCode: "BRL", Balance: pluggy.Decimal(balance), Quantity: "1000",
		Date: date + "T00:00:00.000Z", DueDate: &due, Issuer: "Bank SA", Rate: "110",
		RateType: "CDI",
	}
}

func (f syncFixture) investments(c *http.Client, connection string) []investmentView {
	f.h.T().Helper()

	r := f.h.Call(c, http.MethodGet, "/api/v1/connections/"+connection+"/investments", nil)
	if r.Status != http.StatusOK {
		f.h.T().Fatalf("investments status %d: %s", r.Status, r.Body)
	}

	var out struct {
		Investments []investmentView `json:"investments"`
	}
	r.Decode(f.h.T(), &out)

	return out.Investments
}

func TestSyncStoresInvestments_S541(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.cdbItem()
	f.sync()

	got := f.investments(f.h.Client, f.conn.ID)
	if len(got) != 1 {
		t.Fatalf("investments = %+v", got)
	}

	inv := got[0]
	if inv.Name != "CDB Bank 110" || inv.Type != "fixed_income" || inv.Subtype != "cdb" ||
		inv.Issuer != "Bank SA" || inv.IndexID != "cdi" || inv.PercentOfIndexBP != 11000 ||
		inv.SpreadBP != 0 || !inv.HasTerms || inv.MaturesOn != "2028-01-10" ||
		inv.Balance.Amount != 105000 || inv.Balance.Currency != "BRL" ||
		inv.BalanceDate != "2026-11-10" || inv.Instrument != "" {
		t.Fatalf("investment = %+v", inv)
	}

	if len(inv.Movements) != 2 {
		t.Fatalf("movements = %+v", inv.Movements)
	}

	for i, want := range []struct {
		kind, date, proposal string
		amount               int64
	}{
		{"buy", "2026-01-10", "application", 100000},
		{"income", "2026-10-01", "income", 5000},
	} {
		m := inv.Movements[i]
		if m.Kind != want.kind || m.Date != want.date || m.Proposal != want.proposal ||
			m.Amount.Amount != want.amount || m.Amount.Currency != "BRL" ||
			m.State != "pending" || m.InvestmentID != inv.ID || m.TransactionID != "" {
			t.Fatalf("movement %d = %+v, want %+v", i, m, want)
		}
	}
}

func TestSyncKeepsInvestmentsOnRepeat_S542(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.cdbItem()
	f.sync()

	first := f.investments(f.h.Client, f.conn.ID)

	f.p.AddInvestment(nubankItem, f.cdb("1062.40", "2026-11-11"))
	f.sync()

	got := f.investments(f.h.Client, f.conn.ID)
	if len(got) != 1 || got[0].ID != first[0].ID || len(got[0].Movements) != 2 {
		t.Fatalf("investments = %+v, first = %+v", got, first)
	}

	if got[0].Balance.Amount != 106240 || got[0].BalanceDate != "2026-11-11" {
		t.Fatalf("balance = %+v on %s", got[0].Balance, got[0].BalanceDate)
	}

	for i, m := range got[0].Movements {
		if m.ID != first[0].Movements[i].ID {
			t.Fatalf("movement %d id = %s, want %s", i, m.ID, first[0].Movements[i].ID)
		}
	}
}

func TestInvestmentsOfAConnectionByRole_S544(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.cdbItem()
	f.sync()

	reader := f.h.JoinAs("reader@example.com", f.h.OwnerID(), "read")
	if got := f.investments(reader, f.conn.ID); len(got) != 1 {
		t.Fatalf("reader sees %+v", got)
	}

	other := f.h.Login("other@example.com")
	f.h.ExpectProblem(
		f.h.Call(other, http.MethodGet, "/api/v1/connections/"+f.conn.ID+"/investments", nil),
		http.StatusNotFound,
		"not_found",
		"",
	)
	f.h.ExpectProblem(
		f.h.Call(
			f.h.Client,
			http.MethodGet,
			"/api/v1/connections/019a0000-0000-7000-8000-000000000000/investments",
			nil,
		),
		http.StatusNotFound,
		"not_found",
		"",
	)
}

// Export design D1: both investment tables are facts; an archive keeps an investment and its
// movements.
func TestArchiveKeepsInvestments(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.cdbItem()
	f.sync()

	archive := exportWith(t, f.h, map[string]any{})
	target := newAggregator(t)

	r := target.h.UploadWith("/api/v1/imports/archive", nil, "export.zip", archive)
	if r.Status != http.StatusOK {
		t.Fatalf("import = %d: %s", r.Status, r.Body)
	}

	var investments, movements int
	if err := target.h.Pool.QueryRow(
		t.Context(),
		`SELECT (SELECT count(*) FROM ingestion_external_investment WHERE books_id = $1),
			(SELECT count(*) FROM ingestion_investment_movement
				WHERE books_id = $1 AND state = 'pending' AND kind IN ('buy', 'income'))`,
		target.h.OwnerID(),
	).Scan(&investments, &movements); err != nil {
		t.Fatal(err)
	}

	if investments != 1 || movements != 2 {
		t.Fatalf("investments = %d, movements = %d; want 1 and 2", investments, movements)
	}
}
