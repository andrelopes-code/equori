package marketdata_test

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/marketdata"
)

func TestContractFacts(t *testing.T) {
	t.Parallel()

	h := apitest.New(t, apitest.Today("2026-01-09"))
	putContractTerms(t, h, "CDBFIXO", map[string]any{
		"matures_on":      "2027-10-01",
		"spread_bp":       1200,
		"day_count":       "bus252",
		"calendar_id":     "weekend",
		"daily_liquidity": true,
	})
	putContractTerms(t, h, "CDBCDI", map[string]any{
		"matures_on":          "2028-01-02",
		"index_id":            "cdi",
		"percent_of_index_bp": 11000,
		"day_count":           "bus252",
	})
	putContractTerms(t, h, "CDBIPCA", map[string]any{
		"matures_on": "2035-05-15",
		"index_id":   "ipca",
		"spread_bp":  600,
		"day_count":  "act365",
	})
	h.MustDo(http.MethodPost, "/api/v1/instruments", map[string]any{
		"code": "PETR4", "type": "stock", "scale": 0, "name": "Petrobras", "quote_currency": "BRL",
	}, http.StatusCreated, nil)

	tests := []struct {
		name string
		code string
		want marketdata.ContractFacts
		err  error
	}{
		{
			name: "LFT",
			code: "LFT.20290301",
			want: marketdata.ContractFacts{
				ReturnKind:     "rate",
				MaturesOn:      date(2029, 3, 1),
				DailyLiquidity: true,
				Sovereign:      true,
			},
		},
		{
			name: "LTN",
			code: "LTN.20280101",
			want: marketdata.ContractFacts{
				ReturnKind: "fixed", MaturesOn: date(2028, 1, 1), Sovereign: true,
			},
		},
		{
			name: "NTNB",
			code: "NTNB.20350515",
			want: marketdata.ContractFacts{
				ReturnKind: "inflation", MaturesOn: date(2035, 5, 15), Sovereign: true,
			},
		},
		{
			name: "terms without index",
			code: "CDBFIXO",
			want: marketdata.ContractFacts{
				ReturnKind: "fixed", MaturesOn: date(2027, 10, 1), DailyLiquidity: true,
			},
		},
		{
			name: "index with a day period",
			code: "CDBCDI",
			want: marketdata.ContractFacts{ReturnKind: "rate", MaturesOn: date(2028, 1, 2)},
		},
		{
			name: "index with a month period",
			code: "CDBIPCA",
			want: marketdata.ContractFacts{ReturnKind: "inflation", MaturesOn: date(2035, 5, 15)},
		},
		{name: "stock", code: "PETR4", err: marketdata.ErrNoTerms},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := h.App.Marketdata.ContractFacts(t.Context(), tt.code)
			if !errors.Is(err, tt.err) {
				t.Fatalf("ContractFacts(%s) error = %v, want %v", tt.code, err, tt.err)
			}

			if got != tt.want {
				t.Fatalf("ContractFacts(%s) = %+v, want %+v", tt.code, got, tt.want)
			}
		})
	}
}

func putContractTerms(t *testing.T, h *apitest.Harness, code string, terms map[string]any) {
	t.Helper()
	defineFixedIncome(t, h, code)

	terms["issued_on"] = "2026-01-02"
	terms["face_value"] = 100000

	h.MustDo(http.MethodPut, "/api/v1/instruments/"+code+"/terms", terms, http.StatusOK, nil)
}

func date(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}
