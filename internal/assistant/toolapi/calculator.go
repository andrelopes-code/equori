package toolapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// KeyKind is the kind of value an address key of a calculator takes.
type KeyKind string

const (
	KindAmount  KeyKind = "amount"
	KindRate    KeyKind = "rate"
	KindInteger KeyKind = "integer"
	KindDecimal KeyKind = "decimal"
	KindMonth   KeyKind = "month"
	KindDate    KeyKind = "date"
	KindID      KeyKind = "id"
	KindChoice  KeyKind = "choice"
	KindDebts   KeyKind = "debts"
)

const (
	maxDebtsLength = 2400
	minRate        = -99.99
	maxRate        = 1000
)

var (
	ratePattern    = regexp.MustCompile(`^-?\d+(\.\d+)?$`)
	integerPattern = regexp.MustCompile(`^\d+$`)
	decimalPattern = regexp.MustCompile(`^\d+(\.\d+)?$`)
	idPattern      = regexp.MustCompile(`^[a-z0-9_]{2,40}$`)
)

// calculatorNames maps the id of a calculator to its English name and the question it answers.
var calculatorNames = map[string]struct{ title, question string }{
	"compound": {
		"Compound interest",
		"How does an investment grow or reach a goal?",
	},
	"rates": {
		"Rate conversion",
		"What is a rate in another period or net of inflation?",
	},
	"correction":         {"Index correction", "What is an amount worth after an index?"},
	"fixed-income":       {"Fixed income", "What does a security pay, net of tax?"},
	"indexer-comparison": {"Compare indexers", "Which securities pay more, net of tax?"},
	"financing": {
		"Financing",
		"What is the installment, amount, rate or term of a loan?",
	},
	"cash-or-installments": {"Cash or installments", "Is cash or installments cheaper?"},
	"credit-cost":          {"Credit cost", "What is the real rate of a loan with fees?"},
	"debt-payoff":          {"Debt payoff", "When are the debts paid?"},
	"recurring-cost": {
		"Recurring cost",
		"What does a recurring payment cost?",
	},
	"own-or-rent": {"Own or rent", "Is owning or renting a home cheaper?"},
}

// CalculatorKey is one address key of a calculator: the kind of its value and, for a choice, the
// accepted values.
type CalculatorKey struct {
	Kind   KeyKind  `json:"kind"`
	Values []string `json:"values,omitempty"`
}

// Calculator is the screen of one calculator with the address keys its route accepts.
type Calculator struct {
	ID   string
	Keys map[string]CalculatorKey
}

// BaseCurrency returns the base currency of a book.
type BaseCurrency func(ctx context.Context, booksID int64) (money.Currency, error)

type calculatorID string

// invalidValue is the reason a value is not accepted for its key; any other error is a failure
// of the tool.
type invalidValue string

func (e invalidValue) Error() string { return string(e) }

type openCalculatorIn struct {
	Calculator calculatorID      `json:"calculator" jsonschema:"calculator to open"`
	Inputs     []calculatorInput `json:"inputs"     jsonschema:"address keys with values"`
}

// calculatorInput is one address key with its value; ADR 012 T4 forbids a map in a tool input.
type calculatorInput struct {
	Key   string `json:"key"   jsonschema:"address key"`
	Value string `json:"value" jsonschema:"value"`
}

type openCalculatorOut struct {
	Path  string `json:"path"  jsonschema:"route of the calculator with its inputs; write it as a Markdown link"`
	Title string `json:"title" jsonschema:"English name of the calculator"`
}

// ParseCalculators reads the table of address keys, sorted by calculator id.
func ParseCalculators(b []byte) ([]Calculator, error) {
	var table map[string]map[string]CalculatorKey
	if err := json.Unmarshal(b, &table); err != nil {
		return nil, fmt.Errorf("parse calculator keys: %w", err)
	}

	calculators := make([]Calculator, 0, len(table))
	for id, keys := range table {
		for key, k := range keys {
			if err := checkKind(k); err != nil {
				return nil, fmt.Errorf("calculator %s key %s: %w", id, key, err)
			}
		}

		calculators = append(calculators, Calculator{ID: id, Keys: keys})
	}

	slices.SortFunc(calculators, func(a, b Calculator) int { return strings.Compare(a.ID, b.ID) })

	return calculators, nil
}

func openCalculator(calculators []Calculator, base BaseCurrency) tool.Tool {
	return tool.New(tool.Spec{
		Name:        "open_calculator",
		Description: calculatorDescription(calculators),
		Effect:      tool.ReadOnly,
		Idempotent:  true,
	}, func(ctx context.Context, booksID int64, in openCalculatorIn) (openCalculatorOut, error) {
		i := slices.IndexFunc(
			calculators,
			func(c Calculator) bool { return c.ID == string(in.Calculator) },
		)
		if i < 0 {
			return openCalculatorOut{}, tool.InvalidArgument(
				"calculator",
				"is not a calculator with a screen",
			)
		}

		query, err := calculatorQuery(ctx, booksID, base, calculators[i], in.Inputs)
		if err != nil {
			return openCalculatorOut{}, err
		}

		path := "/calculators/" + calculators[i].ID
		if query != "" {
			path += "?" + query
		}

		return openCalculatorOut{Path: path, Title: calculatorTitle(calculators[i].ID)}, nil
	})
}

func calculatorQuery(
	ctx context.Context,
	booksID int64,
	base BaseCurrency,
	c Calculator,
	inputs []calculatorInput,
) (string, error) {
	var currency money.Currency

	// The base currency is read at most once per call, when the first amount asks for it.
	readCurrency := func() (money.Currency, error) {
		if currency != "" {
			return currency, nil
		}

		cur, err := base(ctx, booksID)
		if err != nil {
			return "", fmt.Errorf("read base currency: %w", err)
		}

		currency = cur

		return cur, nil
	}
	query := url.Values{}

	for _, in := range inputs {
		k, ok := c.Keys[in.Key]
		if !ok {
			return "", tool.InvalidArgument("inputs."+in.Key, "is not an address key of "+c.ID)
		}

		if query.Has(in.Key) {
			return "", tool.InvalidArgument("inputs."+in.Key, "is given twice")
		}

		value, err := inputValue(readCurrency, k, in.Value)
		if reason, ok := errors.AsType[invalidValue](err); ok {
			return "", tool.InvalidArgument("inputs."+in.Key, string(reason))
		}

		if err != nil {
			return "", err
		}

		query.Set(in.Key, value)
	}

	return query.Encode(), nil
}

func inputValue(
	readCurrency func() (money.Currency, error),
	k CalculatorKey,
	v string,
) (string, error) {
	switch k.Kind {
	case KindAmount:
		return amountValue(readCurrency, v)
	case KindRate:
		return v, checkRate(v)
	case KindInteger:
		return v, matches(integerPattern, v, "must be a non-negative integer")
	case KindDecimal:
		return v, matches(decimalPattern, v, "must be a non-negative decimal such as 2.5")
	case KindMonth:
		return v, checkTime("2006-01", v, "must be a month as YYYY-MM")
	case KindDate:
		return v, checkTime(time.DateOnly, v, "must be a date as YYYY-MM-DD")
	case KindID:
		return v, matches(idPattern, v, "must be an id of 2 to 40 characters a-z, 0-9 or _")
	case KindChoice:
		if !slices.Contains(k.Values, v) {
			return "", invalidValue("must be one of " + strings.Join(k.Values, ", "))
		}
	case KindDebts:
		if utf8.RuneCountInString(v) > maxDebtsLength {
			return "", invalidValue(fmt.Sprintf("must have at most %d characters", maxDebtsLength))
		}
	}

	return v, nil
}

func amountValue(readCurrency func() (money.Currency, error), v string) (string, error) {
	currency, err := readCurrency()
	if err != nil {
		return "", err
	}

	m, err := money.ParseDecimal(v, currency, currency.MinorUnits())
	if err != nil {
		return "", invalidValue(fmt.Sprintf(
			"must be a decimal such as 125.90 with at most %d decimals in %s",
			currency.MinorUnits(),
			currency,
		))
	}

	if m.IsNegative() {
		return "", invalidValue("must not be negative")
	}

	return strconv.FormatInt(m.Amount(), 10), nil
}

func checkRate(v string) error {
	if err := matches(ratePattern, v, "must be a percent such as 10 or 0.85"); err != nil {
		return err
	}

	if f, err := strconv.ParseFloat(v, 64); err != nil || f < minRate || f > maxRate {
		return invalidValue(fmt.Sprintf("must be between %v and %v", minRate, maxRate))
	}

	return nil
}

func matches(p *regexp.Regexp, v, message string) error {
	if !p.MatchString(v) {
		return invalidValue(message)
	}

	return nil
}

func checkTime(layout, v, message string) error {
	if _, err := time.Parse(layout, v); err != nil {
		return invalidValue(message)
	}

	return nil
}

func checkKind(k CalculatorKey) error {
	switch k.Kind {
	case KindAmount, KindRate, KindInteger, KindDecimal, KindMonth, KindDate, KindID, KindDebts:
		return nil
	case KindChoice:
		if len(k.Values) == 0 {
			return errors.New("choice without values")
		}

		return nil
	}

	return fmt.Errorf("unknown kind %q", k.Kind)
}

func calculatorTitle(id string) string {
	if n, ok := calculatorNames[id]; ok {
		return n.title
	}

	return id
}

func calculatorDescription(calculators []Calculator) string {
	var b strings.Builder

	b.WriteString("Use it to link a calculator with its inputs filled. ")
	b.WriteString("Prefer this link to computing the figure: ")
	b.WriteString("the screen shows the result, the evidence and the method. ")
	b.WriteString("Do not use it for the book's data. ")
	b.WriteString("Keys by kind, amounts in the base currency, rates in percent:\n")

	for _, c := range calculators {
		fmt.Fprintf(&b, "%s: %s %s\n", c.ID, calculatorNames[c.ID].question, keyList(c))
	}

	return b.String()
}

// keyList groups the keys of a calculator by kind; a choice shows its values.
func keyList(c Calculator) string {
	byKind := map[KeyKind][]string{}
	for key, k := range c.Keys {
		if k.Kind == KindChoice {
			key += "=" + strings.Join(k.Values, "|")
		}

		byKind[k.Kind] = append(byKind[k.Kind], key)
	}

	groups := make([]string, 0, len(byKind))
	for kind, keys := range byKind {
		slices.Sort(keys)
		groups = append(groups, string(kind)+" "+strings.Join(keys, ","))
	}

	slices.Sort(groups)

	if len(groups) == 0 {
		return "No keys."
	}

	return strings.Join(groups, "; ") + "."
}
