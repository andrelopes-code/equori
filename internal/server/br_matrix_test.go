package server_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
)

// TestBRProductMatrix runs each supported Brazilian product twice, through the HTTP operations
// and through the tools, and checks the value, the tax estimate and the issuer exposure against
// the published example of the row (assistant parity design, M1 to M5).
func TestBRProductMatrix(t *testing.T) {
	t.Parallel()

	for _, row := range apitest.BRProducts() {
		for _, path := range []string{"http", "tool"} {
			t.Run(row.ID+"/"+path, func(t *testing.T) {
				t.Parallel()

				h := apitest.New(t, apitest.As(apitest.Brazil()), apitest.Today(row.ValuedOn))
				brokerage, cash := matrixBrokerage(t, h)

				var got matrixFigures
				if path == "http" {
					instrument := applyHTTP(t, h, row, brokerage, cash)
					h.App.Marketdata.TickFeeds(t.Context())
					h.Dispatch()
					got = figuresHTTP(t, h, row, instrument)
				} else {
					instrument := applyTool(t, h, row, brokerage, cash)
					h.App.Marketdata.TickFeeds(t.Context())
					h.Dispatch()
					got = figuresTool(t, h, row, instrument)
				}

				want := matrixFigures{
					Value:     row.WantValue,
					IncomeTax: row.WantIncomeTax,
					IOF:       row.WantIOF,
					Net:       row.WantNet,
					Excess:    row.WantExcess,
					Uncovered: row.WantUncovered,
					Sovereign: row.WantSovereign,
				}
				if got != want {
					t.Errorf(
						"%s %s = %+v, want %+v (source: %s)",
						row.ID,
						row.Name,
						got,
						want,
						row.Source,
					)
				}
			})
		}
	}
}

// matrixFigures are the figures a row checks, as decimal strings in BRL.
type matrixFigures struct {
	Value, IncomeTax, IOF, Net, Excess, Uncovered, Sovereign string
}

func matrixBrokerage(t *testing.T, h *apitest.Harness) (string, string) {
	t.Helper()

	var inst struct {
		ID string `json:"id"`
	}
	h.MustDo(
		http.MethodPost,
		"/api/v1/institutions",
		map[string]string{"name": "XP"},
		http.StatusCreated,
		&inst,
	)

	brokerage := h.Account("XP", "asset", "brokerage", map[string]any{"institution_id": inst.ID})
	cash := h.Account("XP cash", "asset", "brokerage", map[string]any{
		"institution_id": inst.ID, "parent_id": brokerage, "currency": "BRL",
	})

	return brokerage, cash
}

func applyHTTP(
	t *testing.T,
	h *apitest.Harness,
	row apitest.BRProduct,
	brokerage, cash string,
) string {
	t.Helper()

	var out struct {
		Instrument string `json:"instrument"`
	}
	h.MustDo(http.MethodPost, "/api/v1/fixed-income-applications", map[string]any{
		"application_id":  uuid.NewString(),
		"brokerage_id":    brokerage,
		"cash_account_id": cash,
		"applied_on":      row.AppliedOn,
		"amount":          map[string]any{"amount": minorBRL(t, row.Amount), "currency": "BRL"},
		"contract":        row.Contract,
	}, http.StatusCreated, &out)

	return out.Instrument
}

func applyTool(
	t *testing.T,
	h *apitest.Harness,
	row apitest.BRProduct,
	brokerage, cash string,
) string {
	t.Helper()

	args := map[string]any{
		"brokerage_id":    brokerage,
		"cash_account_id": cash,
		"applied_on":      row.AppliedOn,
		"amount":          row.Amount,
	}
	for k, v := range row.Args {
		args[k] = v
	}

	var out struct {
		Instrument string `json:"instrument"`
	}
	matrixTool(t, h, "record_fixed_income", args, &out)

	return out.Instrument
}

func figuresHTTP(
	t *testing.T,
	h *apitest.Harness,
	row apitest.BRProduct,
	instrument string,
) matrixFigures {
	t.Helper()

	type money struct {
		Amount int64 `json:"amount"`
	}

	var positions struct {
		Items []struct {
			AccountID   string `json:"account_id"`
			Instrument  string `json:"instrument"`
			Quantity    money  `json:"quantity"`
			MarketValue money  `json:"market_value"`
		} `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/positions?date="+row.ValuedOn, nil, http.StatusOK, &positions)

	var exposure struct {
		Issuers []struct {
			Excess         money `json:"excess"`
			UncoveredValue money `json:"uncovered_value"`
			SovereignValue money `json:"sovereign_value"`
		} `json:"issuers"`
	}
	h.MustDo(
		http.MethodGet,
		"/api/v1/issuer-exposure?date="+row.ValuedOn,
		nil,
		http.StatusOK,
		&exposure,
	)

	var f matrixFigures
	for _, p := range positions.Items {
		if p.Instrument != instrument {
			continue
		}

		f.Value = decimalBRL(p.MarketValue.Amount)
		if row.WantIncomeTax == "" {
			continue
		}

		var w struct {
			IncomeTax money `json:"income_tax"`
			IOF       money `json:"iof"`
			Net       money `json:"net"`
		}
		h.MustDo(http.MethodGet, fmt.Sprintf(
			"/api/v1/accounts/%s/withholding?date=%s&quantity=%d&proceeds=%d",
			p.AccountID,
			row.ValuedOn,
			p.Quantity.Amount,
			p.MarketValue.Amount,
		), nil, http.StatusOK, &w)

		f.IncomeTax, f.IOF, f.Net = decimalBRL(
			w.IncomeTax.Amount,
		), decimalBRL(
			w.IOF.Amount,
		), decimalBRL(
			w.Net.Amount,
		)
	}

	if len(exposure.Issuers) == 1 {
		f.Excess = decimalBRL(exposure.Issuers[0].Excess.Amount)
		f.Uncovered = decimalBRL(exposure.Issuers[0].UncoveredValue.Amount)
		f.Sovereign = decimalBRL(exposure.Issuers[0].SovereignValue.Amount)
	}

	return f
}

func figuresTool(
	t *testing.T,
	h *apitest.Harness,
	row apitest.BRProduct,
	instrument string,
) matrixFigures {
	t.Helper()

	type money struct {
		Amount string `json:"amount"`
	}

	var positions struct {
		Positions []struct {
			AccountID   string `json:"account_id"`
			Instrument  string `json:"instrument"`
			Quantity    money  `json:"quantity"`
			MarketValue money  `json:"market_value"`
		} `json:"positions"`
	}
	matrixTool(
		t,
		h,
		"get_portfolio",
		map[string]any{"view": "positions", "date": row.ValuedOn},
		&positions,
	)

	var exposure struct {
		Issuers []struct {
			Excess         money `json:"excess"`
			UncoveredValue money `json:"uncovered_value"`
			SovereignValue money `json:"sovereign_value"`
		} `json:"issuers"`
	}
	matrixTool(
		t,
		h,
		"get_portfolio",
		map[string]any{"view": "issuer_exposure", "date": row.ValuedOn},
		&exposure,
	)

	var f matrixFigures
	for _, p := range positions.Positions {
		if p.Instrument != instrument {
			continue
		}

		f.Value = p.MarketValue.Amount
		if row.WantIncomeTax == "" {
			continue
		}

		var estimate struct {
			IncomeTax money `json:"income_tax"`
			IOF       money `json:"iof"`
			Net       money `json:"net"`
		}
		matrixTool(t, h, "estimate_redemption", map[string]any{
			"account_id": p.AccountID,
			"date":       row.ValuedOn,
			"quantity":   p.Quantity.Amount,
			"proceeds":   p.MarketValue.Amount,
		}, &estimate)

		f.IncomeTax, f.IOF, f.Net = estimate.IncomeTax.Amount, estimate.IOF.Amount, estimate.Net.Amount
	}

	if len(exposure.Issuers) == 1 {
		f.Excess = exposure.Issuers[0].Excess.Amount
		f.Uncovered = exposure.Issuers[0].UncoveredValue.Amount
		f.Sovereign = exposure.Issuers[0].SovereignValue.Amount
	}

	return f
}

func matrixTool(t *testing.T, h *apitest.Harness, name string, args map[string]any, out any) {
	t.Helper()

	r := h.Tool(name, args)
	if r.IsError {
		t.Fatalf("%s = %s", name, r.Content)
	}

	if err := json.Unmarshal(r.Content, out); err != nil {
		t.Fatalf("%s: %v: %s", name, err, r.Content)
	}
}

// minorBRL reads a decimal string of BRL as cents.
func minorBRL(t *testing.T, s string) int64 {
	t.Helper()

	var units, cents int64
	if _, err := fmt.Sscanf(s, "%d.%02d", &units, &cents); err != nil {
		t.Fatalf("amount %q: %v", s, err)
	}

	return units*100 + cents
}

func decimalBRL(cents int64) string { return fmt.Sprintf("%d.%02d", cents/100, cents%100) }
