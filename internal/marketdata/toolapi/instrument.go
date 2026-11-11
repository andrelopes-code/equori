package toolapi

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

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

func termsText(t domain.Terms) string {
	return fmt.Sprintf("issued %s, matures %s, index %q at %d bp plus %d bp, %s",
		t.IssuedOn.Format(time.DateOnly), t.MaturesOn.Format(time.DateOnly), t.IndexID, t.PercentOfIndexBP, t.SpreadBP, t.DayCount)
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
