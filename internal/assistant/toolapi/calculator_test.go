package toolapi_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"maps"
	"net/url"
	"os"
	"regexp"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/assistant/toolapi"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/web"
)

var questionPattern = regexp.MustCompile(`"calc\.([a-z-]+)\.question":\s*"([^"]*)"`)

func TestOpenCalculator(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		base       money.Currency
		calc       string
		inputs     map[string]string
		extra      [][2]string // pairs appended after the sorted inputs, to repeat a key
		baseErr    bool
		wantPath   string
		wantTitle  string
		wantField  string
		wantSchema string // a schema rejection: the detail names this property
		wantQuery  string
		wantFault  bool // an error that is not invalid_arguments
		wantReads  int  // base currency reads; checked when above zero
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
			name:       "unwritten",
			base:       "BRL",
			calc:       "reserve",
			wantSchema: "/properties/calculator",
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
		{
			name:      "duplicate_key",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"rate": "1"},
			extra:     [][2]string{{"rate", "2"}},
			wantField: "inputs.rate",
		},
		{
			name:      "rate_lower_bound",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"rate": "-99.99"},
			wantPath:  "/calculators/financing?rate=-99.99",
			wantTitle: "Financing",
		},
		{
			name:      "rate_below_bound",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"rate": "-100"},
			wantField: "inputs.rate",
		},
		{
			name:      "rate_above_bound",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"rate": "1000.01"},
			wantField: "inputs.rate",
		},
		{
			name:      "value_at_length_limit",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"rate": "1." + strings.Repeat("0", 62)},
			wantPath:  "/calculators/financing?rate=1." + strings.Repeat("0", 62),
			wantTitle: "Financing",
		},
		{
			name:      "value_over_length_limit",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"rate": "1." + strings.Repeat("0", 63)},
			wantField: "inputs.rate",
		},
		{
			name:      "integer_plus",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"prepayMonth": "+3"},
			wantField: "inputs.prepayMonth",
		},
		{
			name:      "integer_minus",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"prepayMonth": "-3"},
			wantField: "inputs.prepayMonth",
		},
		{
			name:      "decimal_trailing_point",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"months": "2."},
			wantField: "inputs.months",
		},
		{
			name:      "month_invalid",
			base:      "BRL",
			calc:      "correction",
			inputs:    map[string]string{"from": "2026-13"},
			wantField: "inputs.from",
		},
		{
			name:      "date_invalid",
			base:      "BRL",
			calc:      "credit-cost",
			inputs:    map[string]string{"firstDue": "2026-02-30"},
			wantField: "inputs.firstDue",
		},
		{
			name:      "id_uppercase",
			base:      "BRL",
			calc:      "compound",
			inputs:    map[string]string{"index": "A"},
			wantField: "inputs.index",
		},
		{
			name:      "debts_at_limit",
			base:      "BRL",
			calc:      "debt-payoff",
			inputs:    map[string]string{"debts": strings.Repeat("a", 2400)},
			wantPath:  "/calculators/debt-payoff",
			wantTitle: "Debt payoff",
			wantQuery: strings.Repeat("a", 2400),
		},
		{
			name:      "debts_over_limit",
			base:      "BRL",
			calc:      "debt-payoff",
			inputs:    map[string]string{"debts": strings.Repeat("a", 2401)},
			wantField: "inputs.debts",
		},
		{
			name:      "debts_utf16",
			base:      "BRL",
			calc:      "debt-payoff",
			inputs:    map[string]string{"debts": strings.Repeat("\U0001F600", 1200)},
			wantPath:  "/calculators/debt-payoff",
			wantTitle: "Debt payoff",
			wantQuery: strings.Repeat("\U0001F600", 1200),
		},
		{
			name:      "debts_utf16_over_limit",
			base:      "BRL",
			calc:      "debt-payoff",
			inputs:    map[string]string{"debts": strings.Repeat("\U0001F600", 1201)},
			wantField: "inputs.debts",
		},
		{
			name:      "amount_at_ceiling",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"amount": "10000000000000"},
			wantPath:  "/calculators/financing?amount=1000000000000000",
			wantTitle: "Financing",
		},
		{
			name:      "amount_ceiling",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"amount": "10000000000000.01"},
			wantField: "inputs.amount",
		},
		{
			name:      "two_amounts",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"amount": "100", "installment": "1"},
			wantPath:  "/calculators/financing?amount=10000&installment=100",
			wantTitle: "Financing",
			wantReads: 1,
		},
		{
			name:      "negative_amount",
			base:      "BRL",
			calc:      "financing",
			inputs:    map[string]string{"amount": "-1"},
			wantField: "inputs.amount",
		},
		{
			name:      "base_currency_error",
			calc:      "financing",
			inputs:    map[string]string{"amount": "1"},
			baseErr:   true,
			wantFault: true,
		},
		{
			name:      "base_currency_unused",
			calc:      "financing",
			inputs:    map[string]string{"rate": "1"},
			baseErr:   true,
			wantPath:  "/calculators/financing?rate=1",
			wantTitle: "Financing",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			reads := 0
			base := baseOf(tt.base, tt.baseErr)
			counted := func(ctx context.Context, booksID int64) (money.Currency, error) {
				reads++

				return base(ctx, booksID)
			}

			res := callOpenCalculator(t, counted, tt.calc, tt.inputs, tt.extra)
			if tt.wantReads > 0 && reads != tt.wantReads {
				t.Fatalf("base currency reads = %d, want %d", reads, tt.wantReads)
			}

			if tt.wantFault {
				checkFault(t, res)
				return
			}

			if tt.wantSchema != "" {
				checkSchemaError(t, res, tt.wantSchema)
				return
			}

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

	checkNames(t, calcs)

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
	base toolapi.BaseCurrency,
	calc string,
	inputs map[string]string,
	extra [][2]string,
) tool.Result {
	t.Helper()

	calcs, err := toolapi.ParseCalculators(web.CalculatorKeys())
	if err != nil {
		t.Fatal(err)
	}

	reg, err := tool.NewRegistry(
		slog.New(slog.NewTextHandler(io.Discard, nil)),
		tool.Group{Tools: toolapi.Tools(nil, calcs, base)},
	)
	if err != nil {
		t.Fatal(err)
	}

	list := []map[string]string{}
	for _, key := range slices.Sorted(maps.Keys(inputs)) {
		list = append(list, map[string]string{"key": key, "value": inputs[key]})
	}

	for _, kv := range extra {
		list = append(list, map[string]string{"key": kv[0], "value": kv[1]})
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

func checkSchemaError(t *testing.T, res tool.Result, property string) {
	t.Helper()

	var e tool.Error
	if err := json.Unmarshal(res.Content, &e); err != nil {
		t.Fatal(err)
	}

	if !res.IsError || e.Code != "invalid_arguments" || !strings.Contains(e.Detail, property) {
		t.Fatalf("result = %s, want invalid_arguments on %s", res.Content, property)
	}
}

func baseOf(currency money.Currency, fail bool) toolapi.BaseCurrency {
	return func(context.Context, int64) (money.Currency, error) {
		if fail {
			return "", errors.New("connection refused by the ledger store")
		}

		return currency, nil
	}
}

func checkFault(t *testing.T, res tool.Result) {
	t.Helper()

	if !res.IsError {
		t.Fatalf("result is not an error: %s", res.Content)
	}

	var e tool.Error
	if err := json.Unmarshal(res.Content, &e); err != nil {
		t.Fatal(err)
	}

	if e.Code == "invalid_arguments" ||
		strings.Contains(string(res.Content), "connection refused") {
		t.Fatalf("error = %s, want a fault without the internal text", res.Content)
	}
}

// checkNames ties the names of the tool to the catalog of the screens: every id has a title and
// the question of its description line is the English "calc.<id>.question".
func checkNames(t *testing.T, calcs []toolapi.Calculator) {
	t.Helper()

	src, err := os.ReadFile("../../../web/src/i18n/catalog-calculators.en.ts")
	if err != nil {
		t.Fatal(err)
	}

	questions := map[string]string{}
	for _, m := range questionPattern.FindAllStringSubmatch(string(src), -1) {
		questions[m[1]] = m[2]
	}

	description := toolapi.Tools(nil, calcs, baseOf("BRL", false))[1].Spec().Description

	for _, c := range calcs {
		want, ok := questions[c.ID]
		if !ok {
			t.Errorf("%s: no calc.%s.question in the English catalog", c.ID, c.ID)

			continue
		}

		if !strings.Contains(description, "\n"+c.ID+": "+want+" ") {
			t.Errorf("%s: description does not hold the catalog question %q", c.ID, want)
		}

		res := callOpenCalculator(t, baseOf("BRL", false), c.ID, nil, nil)

		var out struct{ Title string }
		if err := json.Unmarshal(res.Content, &out); err != nil {
			t.Fatal(err)
		}

		if out.Title == "" || out.Title == c.ID {
			t.Errorf("%s: title = %q, want an English name", c.ID, out.Title)
		}
	}
}
