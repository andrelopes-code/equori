package toolapi

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type manageInstrumentAction string

func (manageInstrumentAction) Values() []string {
	return []string{"define", "rename", "edit", "record_price", "set_terms", "request_history", "delete"}
}

type manageInstrumentDayCount string

func (manageInstrumentDayCount) Values() []string { return []string{"bus252", "act365"} }

type manageInstrumentType string

func (manageInstrumentType) Values() []string {
	return []string{"currency", "stock", "etf", "reit", "depositary_receipt", "fixed_income", "fund", "crypto"}
}

type manageInstrumentIn struct {
	Action           manageInstrumentAction `json:"action" jsonschema:"operation to propose"`
	Code             string                 `json:"code" jsonschema:"instrument code"`
	Name             string                 `json:"name,omitzero" jsonschema:"for define and rename: instrument name"`
	Type             manageInstrumentType   `json:"type,omitzero" jsonschema:"for define: instrument type"`
	QuoteCurrency    string                 `json:"quote_currency,omitzero" jsonschema:"for define: currency the instrument is priced in"`
	Scale            int                    `json:"scale,omitzero" jsonschema:"for define: decimal places of a quantity"`
	Date             tool.Date              `json:"date,omitzero" jsonschema:"for record_price: price date"`
	Price            string                 `json:"price,omitzero" jsonschema:"for record_price: decimal price of one unit in quote_currency"`
	IssuedOn         tool.Date              `json:"issued_on,omitzero" jsonschema:"for set_terms: issue date"`
	MaturesOn        tool.Date              `json:"matures_on,omitzero" jsonschema:"for set_terms: maturity date"`
	FaceValue        string                 `json:"face_value,omitzero" jsonschema:"for set_terms: face value"`
	IndexID          string                 `json:"index_id,omitzero" jsonschema:"for set_terms: index identifier; absent for a fixed rate"`
	PercentOfIndexBP int                    `json:"percent_of_index_bp,omitzero" jsonschema:"for set_terms: percentage of the index in basis points, 11000 for 110%"`
	SpreadBP         int                    `json:"spread_bp,omitzero" jsonschema:"for set_terms: annual spread in basis points"`
	From             tool.Date              `json:"from,omitzero" jsonschema:"for request_history: first date of the prices to load"`

	Exchange string                   `json:"exchange,omitzero" jsonschema:"for define and edit: ISO 10383 market code, such as BVMF"`
	Subtype  string                   `json:"subtype,omitzero" jsonschema:"for define and edit: refines the type, such as cdb or fii_papel"`
	Symbols  []string                 `json:"symbols,omitzero" jsonschema:"for define and edit: source=symbol entries, such as yahoo=PETR4.SA; an empty list on edit clears them"`
	DayCount manageInstrumentDayCount `json:"day_count,omitzero" jsonschema:"for set_terms: bus252 needs a daily index; follows the index when absent"`
}

type manageInstrumentOut struct {
	Instrument instrumentView `json:"instrument,omitzero"`
	Price      priceView      `json:"price,omitzero"`
	Terms      termsView      `json:"terms,omitzero"`
}

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

func termsText(t domain.Terms) string {
	return fmt.Sprintf("issued %s, matures %s, index %q at %d bp plus %d bp, %s",
		t.IssuedOn.Format(time.DateOnly), t.MaturesOn.Format(time.DateOnly), t.IndexID, t.PercentOfIndexBP, t.SpreadBP, t.DayCount)
}

func manageInstrument(svc Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "manage_instrument",
		Description: "Proposes defining, renaming or deleting a security for the whole instance (a security that a position, an account or a transaction uses cannot be deleted), recording a manual price, setting the terms of a fixed income instrument, or loading the price history of an instrument since a date from the enabled sources. " +
			"Use it when the user needs a security that does not exist yet or a price that is missing. " +
			"Do not use it to buy or sell: record_investment does. " +
			"Instruments and prices are shared by every book of the instance; the user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, _ int64, in manageInstrumentIn) (tool.Preview, error) {
		if err := checkInstrumentArgs(in); err != nil {
			return tool.Preview{}, err
		}

		p := tool.Preview{Action: "manage_instrument." + string(in.Action), Target: "Instrument " + in.Code}
		switch in.Action {
		case "define":
			def, err := in.instrument()
			if err == nil {
				def, err = def.Validate()
			}

			if err != nil {
				return tool.Preview{}, err
			}

			if _, err := svc.Instrument(ctx, in.Code); err == nil {
				return tool.Preview{}, domain.ErrInstrumentExists
			} else if !errors.Is(err, domain.ErrUnknownInstrument) {
				return tool.Preview{}, err
			}

			if q, err := svc.Instrument(ctx, in.QuoteCurrency); err != nil || q.Type != domain.TypeCurrency {
				return tool.Preview{}, &domain.FieldError{Field: "quote_currency", Message: "must be a currency"}
			}

			p.Changes = []tool.Change{
				{Field: "instrument", After: tool.TextValue(string(def.Code))}, {Field: "name", After: tool.TextValue(def.Name)},
				{Field: "kind", After: tool.TextValue(def.Type)}, {Field: "currency", After: tool.TextValue(string(def.QuoteCurrency))},
			}
			p.Changes = append(p.Changes, instrumentFactChanges(domain.Instrument{}, def)...)
		case "rename":
			inst, err := svc.Instrument(ctx, in.Code)
			if err != nil {
				return tool.Preview{}, err
			}

			if inst.Type == domain.TypeCurrency {
				return tool.Preview{}, &domain.FieldError{Field: "code", Message: "is a currency"}
			}

			before := inst.Name

			inst.Name = in.Name
			if inst, err = inst.Validate(); err != nil {
				return tool.Preview{}, err
			}

			p.Changes = []tool.Change{{Field: "name", Before: tool.TextValue(before), After: tool.TextValue(inst.Name)}}
		case "edit":
			inst, err := svc.Instrument(ctx, in.Code)
			if err != nil {
				return tool.Preview{}, err
			}

			if inst.Type == domain.TypeCurrency {
				return tool.Preview{}, &domain.FieldError{Field: "code", Message: "is a currency"}
			}

			after, err := in.edited(inst)
			if err != nil {
				return tool.Preview{}, err
			}

			p.Changes = instrumentFactChanges(inst, after)
		case "record_price":
			inst, err := svc.Instrument(ctx, in.Code)
			if err != nil {
				return tool.Preview{}, err
			}

			if inst.QuoteCurrency == "" {
				return tool.Preview{}, tool.InvalidArgument("code", "has no quote currency; prices belong to securities")
			}

			if _, err := parsePrice(in.Price); err != nil {
				return tool.Preview{}, err
			}

			p.Changes = []tool.Change{
				{Field: "price", After: tool.TextValue(in.Price + " " + string(inst.QuoteCurrency))}, {Field: "date", After: tool.DateValue(in.Date.Time)},
			}
		case "delete":
			inst, err := svc.Instrument(ctx, in.Code)
			if err != nil {
				return tool.Preview{}, err
			}

			if inst.Type == domain.TypeCurrency {
				return tool.Preview{}, &domain.FieldError{Field: "code", Message: "is a currency"}
			}

			p.Destructive = true
			p.Changes = []tool.Change{{Field: "instrument", Before: tool.TextValue(string(inst.Code) + " " + inst.Name)}}
		case "request_history":
			if _, err := svc.Instrument(ctx, in.Code); err != nil {
				return tool.Preview{}, err
			}

			p.Changes = []tool.Change{{Field: "from", After: tool.DateValue(in.From.Time)}}
		case "set_terms":
			inst, err := svc.Instrument(ctx, in.Code)
			if err != nil {
				return tool.Preview{}, err
			}

			t, err := in.terms(inst.QuoteCurrency, svc.BusinessDayIndexes())
			if err != nil {
				return tool.Preview{}, err
			}

			if err := t.Validate(svc.BusinessDayIndexes()); err != nil {
				return tool.Preview{}, err
			}

			if inst.Type != "fixed_income" {
				return tool.Preview{}, &domain.FieldError{Field: "code", Message: "terms belong to a fixed_income instrument"}
			}

			change := tool.Change{Field: "terms", After: tool.TextValue(termsText(t))}
			if old, err := svc.Terms(ctx, in.Code); err == nil {
				change.Before = tool.TextValue(termsText(old))
			}

			p.Changes = []tool.Change{change}
		}

		return p, nil
	}, func(ctx context.Context, _ int64, in manageInstrumentIn) (manageInstrumentOut, error) {
		if err := checkInstrumentArgs(in); err != nil {
			return manageInstrumentOut{}, err
		}

		switch in.Action {
		case "define":
			def, err := in.instrument()
			if err != nil {
				return manageInstrumentOut{}, err
			}

			def, err = svc.DefineInstrument(ctx, def)

			return manageInstrumentOut{Instrument: toInstrumentView(def)}, err
		case "edit":
			inst, err := svc.Instrument(ctx, in.Code)
			if err != nil {
				return manageInstrumentOut{}, err
			}

			if inst.Type == domain.TypeCurrency {
				return manageInstrumentOut{}, &domain.FieldError{Field: "code", Message: "is a currency"}
			}

			after, err := in.edited(inst)
			if err != nil {
				return manageInstrumentOut{}, err
			}

			after, err = svc.EditInstrument(ctx, in.Code, after.Name, after.Exchange, after.Subtype, in.symbolsForEdit(after))

			return manageInstrumentOut{Instrument: toInstrumentView(after)}, err
		case "rename":
			inst, err := svc.Instrument(ctx, in.Code)
			if err != nil {
				return manageInstrumentOut{}, err
			}

			inst, err = svc.EditInstrument(ctx, in.Code, in.Name, inst.Exchange, inst.Subtype, nil)

			return manageInstrumentOut{Instrument: toInstrumentView(inst)}, err
		case "record_price":
			inst, err := svc.Instrument(ctx, in.Code)
			if err != nil {
				return manageInstrumentOut{}, err
			}

			if inst.QuoteCurrency == "" {
				return manageInstrumentOut{}, tool.InvalidArgument("code", "has no quote currency; prices belong to securities")
			}

			v, err := parsePrice(in.Price)
			if err != nil {
				return manageInstrumentOut{}, err
			}

			err = svc.RecordPrices(ctx, []domain.Price{{Instrument: inst.Code, Quote: inst.QuoteCurrency, Date: in.Date.Time, Value: v, Source: domain.SourceManual}})

			return manageInstrumentOut{Price: priceView{Date: in.Date, Value: v.Reduced().String()}}, err
		case "delete":
			return manageInstrumentOut{}, svc.DeleteInstrument(ctx, in.Code)
		case "request_history":
			if err := svc.RequestHistory(ctx, in.Code, in.From.Time); err != nil {
				return manageInstrumentOut{}, err
			}

			inst, err := svc.Instrument(ctx, in.Code)

			return manageInstrumentOut{Instrument: toInstrumentView(inst)}, err
		}

		inst, err := svc.Instrument(ctx, in.Code)
		if err != nil {
			return manageInstrumentOut{}, err
		}

		t, err := in.terms(inst.QuoteCurrency, svc.BusinessDayIndexes())
		if err != nil {
			return manageInstrumentOut{}, err
		}

		t, err = svc.PutTerms(ctx, in.Code, t)
		if err != nil {
			return manageInstrumentOut{}, err
		}

		v, err := toTermsView(t, inst.QuoteCurrency)

		return manageInstrumentOut{Terms: v}, err
	})
}

// symbolsForEdit returns the symbols to send to EditInstrument: nil keeps the stored set.
func (in manageInstrumentIn) symbolsForEdit(after domain.Instrument) map[string]string {
	if in.Symbols == nil {
		return nil
	}

	if after.Symbols == nil {
		return map[string]string{}
	}

	return after.Symbols
}

// instrumentFactChanges lists the exchange, subtype, name and symbols that differ between two states.
func instrumentFactChanges(before, after domain.Instrument) []tool.Change {
	var changes []tool.Change

	text := tool.TextValue
	if before.Name != after.Name && before.Name != "" {
		changes = append(changes, tool.Change{Field: "name", Before: text(before.Name), After: text(after.Name)})
	}

	if before.Exchange != after.Exchange {
		changes = append(changes, tool.Change{Field: "exchange", Before: text(before.Exchange), After: text(after.Exchange)})
	}

	if before.Subtype != after.Subtype {
		changes = append(changes, tool.Change{Field: "subtype", Before: text(before.Subtype), After: text(after.Subtype)})
	}

	if !maps.Equal(before.Symbols, after.Symbols) {
		changes = append(changes, tool.Change{Field: "symbols", Before: text(symbolsText(before.Symbols)), After: text(symbolsText(after.Symbols))})
	}

	return changes
}

// symbolsText renders symbols as source=symbol entries sorted by source.
func symbolsText(m map[string]string) string {
	entries := make([]string, 0, len(m))
	for _, k := range slices.Sorted(maps.Keys(m)) {
		entries = append(entries, k+"="+m[k])
	}

	return strings.Join(entries, ", ")
}
