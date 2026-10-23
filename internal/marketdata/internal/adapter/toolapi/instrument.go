package toolapi

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type manageInstrumentAction string

func (manageInstrumentAction) Values() []string {
	return []string{"define", "record_price", "set_terms"}
}

type manageInstrumentType string

func (manageInstrumentType) Values() []string {
	return []string{"currency", "stock", "etf", "reit", "depositary_receipt", "fixed_income", "fund", "crypto"}
}

type manageInstrumentIn struct {
	Action           manageInstrumentAction `json:"action" jsonschema:"operation to propose"`
	Code             string                 `json:"code" jsonschema:"instrument code"`
	Name             string                 `json:"name,omitzero" jsonschema:"for define: instrument name"`
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
	}
	name := string(in.Action)
	switch in.Action {
	case "define":
		// A zero scale is valid and cannot be told from an absent one.
		return required(name, slices.DeleteFunc(slices.Clone(fields), func(f field) bool { return f.name == "scale" }), "name", "type", "quote_currency")
	case "record_price":
		return required(name, fields, "date", "price")
	}
	return required(name, slices.DeleteFunc(slices.Clone(fields), func(f field) bool { return slices.Contains(optionalTermFields, f.name) }),
		"issued_on", "matures_on", "face_value")
}

func (in manageInstrumentIn) instrument() domain.Instrument {
	return domain.Instrument{Code: money.Currency(in.Code), Type: string(in.Type), Scale: in.Scale, Name: in.Name, QuoteCurrency: money.Currency(in.QuoteCurrency)}
}

func parsePrice(s string) (money.Rate, error) {
	v, err := money.ParseRate(s)
	if err != nil {
		return money.Rate{}, tool.InvalidArgument("price", "must be a positive decimal with at most 12 decimals")
	}
	return v, nil
}

// terms builds the contract of a fixed income instrument; the day count follows the index.
func (in manageInstrumentIn) terms(quote money.Currency) (domain.Terms, error) {
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
	if t.PercentOfIndexBP == 0 {
		t.PercentOfIndexBP = 10000
	}
	if t.IndexID == domain.IndexCDI {
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
		Description: "Proposes defining a security for the whole instance, recording a manual price, or setting the terms of a fixed income instrument. " +
			"Use it when the user needs a security that does not exist yet or a price that is missing. " +
			"Do not use it to buy or sell: record_investment does. " +
			"Instruments and prices are shared by every user of the instance; the user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, _ int64, in manageInstrumentIn) (tool.Preview, error) {
		if err := checkInstrumentArgs(in); err != nil {
			return tool.Preview{}, err
		}
		p := tool.Preview{Action: "manage_instrument." + string(in.Action), Target: "Instrument " + in.Code}
		switch in.Action {
		case "define":
			def, err := in.instrument().Validate()
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
		case "set_terms":
			inst, err := svc.Instrument(ctx, in.Code)
			if err != nil {
				return tool.Preview{}, err
			}
			t, err := in.terms(inst.QuoteCurrency)
			if err != nil {
				return tool.Preview{}, err
			}
			if err := t.Validate(); err != nil {
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
			def, err := svc.DefineInstrument(ctx, in.instrument())
			return manageInstrumentOut{Instrument: toInstrumentView(def)}, err
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
		}
		inst, err := svc.Instrument(ctx, in.Code)
		if err != nil {
			return manageInstrumentOut{}, err
		}
		t, err := in.terms(inst.QuoteCurrency)
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
