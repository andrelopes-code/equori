package toolapi

import (
	"fmt"
	"slices"
	"strings"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// optionalTermFields may be absent in set_terms; the contract gives them defaults.
var optionalTermFields = []string{"index_id", "percent_of_index_bp", "spread_bp"}

func checkInstrumentArgs(in manageInstrumentIn) error {
	if in.Code == "" {
		return tool.InvalidArgument("code", "is required")
	}

	fields := []field{
		{"name", in.Name != ""}, {"type", in.Type != ""}, {"quote_currency", in.QuoteCurrency != ""}, {"scale", in.Scale != 0},
		{"date", !in.Date.IsZero()}, {"price", in.Price != ""},
		{"issued_on", !in.IssuedOn.IsZero()}, {"matures_on", !in.MaturesOn.IsZero()}, {"face_value", in.FaceValue != ""},
		{"index_id", in.IndexID != ""}, {"percent_of_index_bp", in.PercentOfIndexBP != 0}, {"spread_bp", in.SpreadBP != 0},
		{"from", !in.From.IsZero()},
		{"exchange", in.Exchange != ""}, {"subtype", in.Subtype != ""}, {"symbols", in.Symbols != nil}, {"day_count", in.DayCount != ""},
	}

	name := string(in.Action)
	switch in.Action {
	case "define":
		// A zero scale is valid and cannot be told from an absent one.
		return required(name, without(fields, "scale", "exchange", "subtype", "symbols"), "name", "type", "quote_currency")
	case "edit":
		if err := required(name, without(fields, "name", "exchange", "subtype", "symbols")); err != nil {
			return err
		}

		if in.Name == "" && in.Exchange == "" && in.Subtype == "" && in.Symbols == nil {
			return tool.InvalidArgument("name", "or exchange, subtype or symbols is required for edit")
		}

		return nil
	case "rename":
		return required(name, fields, "name")
	case "record_price":
		return required(name, fields, "date", "price")
	case "request_history":
		return required(name, fields, "from")
	case "delete":
		return required(name, fields)
	}

	return required(name, without(fields, append([]string{"day_count"}, optionalTermFields...)...), "issued_on", "matures_on", "face_value")
}

// without returns fields minus the named ones, which an action takes as optional.
func without(fields []field, names ...string) []field {
	return slices.DeleteFunc(slices.Clone(fields), func(f field) bool { return slices.Contains(names, f.name) })
}

// symbolMap reads source=symbol entries; a nil list reads as nil and an empty one as an empty map.
func symbolMap(entries []string) (map[string]string, error) {
	if entries == nil {
		return nil, nil
	}

	m := make(map[string]string, len(entries))

	for _, e := range entries {
		source, symbol, ok := strings.Cut(e, "=")
		if !ok || source == "" || symbol == "" {
			return nil, tool.InvalidArgument("symbols", fmt.Sprintf("entry %q must read source=symbol", e))
		}

		m[source] = symbol
	}

	return m, nil
}

func (in manageInstrumentIn) instrument() (domain.Instrument, error) {
	symbols, err := symbolMap(in.Symbols)
	if err != nil {
		return domain.Instrument{}, err
	}

	return domain.Instrument{
		Code: money.Currency(in.Code), Type: string(in.Type), Scale: in.Scale, Name: in.Name, QuoteCurrency: money.Currency(in.QuoteCurrency),
		Exchange: in.Exchange, Subtype: in.Subtype, Symbols: symbols,
	}, nil
}

// edited applies an edit call to inst: a field the call leaves out keeps its value.
func (in manageInstrumentIn) edited(inst domain.Instrument) (domain.Instrument, error) {
	symbols, err := symbolMap(in.Symbols)
	if err != nil {
		return domain.Instrument{}, err
	}

	if in.Name != "" {
		inst.Name = in.Name
	}

	if in.Exchange != "" {
		inst.Exchange = in.Exchange
	}

	if in.Subtype != "" {
		inst.Subtype = in.Subtype
	}

	if symbols != nil {
		inst.Symbols = symbols
	}

	return inst.Validate()
}

func parsePrice(s string) (money.Rate, error) {
	v, err := money.ParseRate(s)
	if err != nil {
		return money.Rate{}, tool.InvalidArgument("price", "must be a positive decimal with at most 12 decimals")
	}

	return v, nil
}

// terms builds the contract of a fixed income instrument; the day count follows the index.
func (in manageInstrumentIn) terms(
	quote money.Currency,
	daily domain.BusinessDayIndexes,
) (domain.Terms, error) {
	unit, err := money.New(0, quote)
	if err != nil {
		return domain.Terms{}, &domain.FieldError{Field: "code", Message: "terms belong to a fixed_income instrument"}
	}

	face, err := tool.ParsePositive("face_value", in.FaceValue, unit)
	if err != nil {
		return domain.Terms{}, err
	}

	t := domain.Terms{
		IssuedOn: in.IssuedOn.Time, MaturesOn: in.MaturesOn.Time, IndexID: in.IndexID, PercentOfIndexBP: in.PercentOfIndexBP,
		SpreadBP: in.SpreadBP, DayCount: domain.DayCountAct365, FaceValue: face.Amount(),
	}
	if in.DayCount != "" {
		t.DayCount = string(in.DayCount)
	}

	if t.PercentOfIndexBP == 0 {
		t.PercentOfIndexBP = 10000
	}

	if in.DayCount == "" && daily.Has(t.IndexID) {
		t.DayCount = domain.DayCountBus252
	}

	return t, nil
}
