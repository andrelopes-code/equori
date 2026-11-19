package toolapi_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"maps"
	"net/url"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/assistant/toolapi"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/web"
)

func TestOpenCalculator(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		base      money.Currency
		calc      string
		inputs    map[string]string
		wantPath  string
		wantTitle string
		wantField string
		wantQuery string
	}{
		{
			name:      "financing",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"amount": "300000", "rate": "10", "months": "360"},
			wantPath:  "/calculators/financing?amount=30000000&months=360&rate=10",
			wantTitle: "Financing",
		},
		{
			name:      "jpy_fraction",
			base:      "JPY",
			calc:      "financing",
			inputs:    map[string]string{"amount": "100.5"},
			wantField: "inputs.amount",
		},
		{
			name:      "unknown_key",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"foo": "1"},
			wantField: "inputs.foo",
		},
		{
			name:      "bad_choice",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"period": "week"},
			wantField: "inputs.period",
		},
		{
			name:      "comparison_empty",
			base:      "BRL",
			calc:      "indexer-comparison",
			wantPath:  "/calculators/indexer-comparison",
			wantTitle: "Compare indexers",
		},
		{
			name:      "unwritten",
			base:      "BRL",
			calc:      "reserve",
			wantField: "calculator",
		},
		{
			name:      "debts_encoded",
			base:      "BRL",
			calc:      "debt-payoff",
			inputs:    map[string]string{"debts": "a~1~2&3"},
			wantPath:  "/calculators/debt-payoff",
			wantTitle: "Debt payoff",
			wantQuery: "a~1~2&3",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			res := callOpenCalculator(t, tt.base, tt.calc, tt.inputs)
			if tt.wantField != "" {
				checkToolError(t, res, tt.wantField)
				return
			}

			if res.IsError {
				t.Fatalf("error result: %s", res.Content)
			}

			var out struct{ Path, Title string }
			if err := json.Unmarshal(res.Content, &out); err != nil {
				t.Fatal(err)
			}

			path, query, _ := strings.Cut(out.Path, "?")

			if tt.wantQuery != "" {
				got, err := url.ParseQuery(query)
				if err != nil || got.Get("debts") != tt.wantQuery || path != tt.wantPath {
					t.Fatalf("path %q, debts %q, err %v", out.Path, got.Get("debts"), err)
				}
			} else if out.Path != tt.wantPath {
				t.Fatalf("path = %q, want %q", out.Path, tt.wantPath)
			}

			if out.Title != tt.wantTitle {
				t.Fatalf("title = %q, want %q", out.Title, tt.wantTitle)
			}
		})
	}
}

func TestParseCalculators(t *testing.T) {
	t.Parallel()

	calcs, err := toolapi.ParseCalculators(web.CalculatorKeys())
	if err != nil {
		t.Fatal(err)
	}

	if len(calcs) != 11 {
		t.Fatalf("calculators = %d, want 11", len(calcs))
	}

	kinds := []toolapi.KeyKind{
		toolapi.KindAmount, toolapi.KindRate, toolapi.KindInteger, toolapi.KindDecimal,
		toolapi.KindMonth, toolapi.KindDate, toolapi.KindID, toolapi.KindChoice, toolapi.KindDebts,
	}
	for _, c := range calcs {
		for key, k := range c.Keys {
			if !slices.Contains(kinds, k.Kind) {
				t.Errorf("%s.%s: unknown kind %q", c.ID, key, k.Kind)
			}
		}
	}

	if !slices.IsSortedFunc(calcs, func(a, b toolapi.Calculator) int {
		return strings.Compare(a.ID, b.ID)
	}) {
		t.Fatalf("calculators are not sorted by id")
	}

	for _, bad := range []string{
		`{"x":{"k":{"kind":"nope"}}}`,
		`{"x":{"k":{"kind":"choice"}}}`,
	} {
		if _, err := toolapi.ParseCalculators([]byte(bad)); err == nil {
			t.Errorf("ParseCalculators(%s) returned no error", bad)
		}
	}
}

func callOpenCalculator(
	t *testing.T,
	base money.Currency,
	calc string,
	inputs map[string]string,
) tool.Result {
	t.Helper()

	calcs, err := toolapi.ParseCalculators(web.CalculatorKeys())
	if err != nil {
		t.Fatal(err)
	}

	reg, err := tool.NewRegistry(
		slog.New(slog.NewTextHandler(io.Discard, nil)),
		tool.Group{
			Tools: toolapi.Tools(nil, calcs, func(context.Context, int64) (money.Currency, error) {
				return base, nil
			}),
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	list := []map[string]string{}
	for _, key := range slices.Sorted(maps.Keys(inputs)) {
		list = append(list, map[string]string{"key": key, "value": inputs[key]})
	}

	args, err := json.Marshal(map[string]any{"calculator": calc, "inputs": list})
	if err != nil {
		t.Fatal(err)
	}

	ctx := auth.WithIdentity(t.Context(), 1, 1, auth.RoleOwner)

	res, err := reg.Call(ctx, "open_calculator", args)
	if err != nil {
		t.Fatal(err)
	}

	return res
}

func checkToolError(t *testing.T, res tool.Result, field string) {
	t.Helper()

	if !res.IsError {
		t.Fatalf("result is not an error: %s", res.Content)
	}

	var e tool.Error
	if err := json.Unmarshal(res.Content, &e); err != nil {
		t.Fatal(err)
	}

	if e.Code != "invalid_arguments" || len(e.Errors) == 0 || e.Errors[0].Field != field {
		t.Fatalf("error = %+v, want invalid_arguments on %s", e, field)
	}
}
