package toolapi

import (
	"context"
	"errors"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func previewInstrument(
	ctx context.Context,
	svc Service,
	in manageInstrumentIn,
) (tool.Preview, error) {
	if err := checkInstrumentArgs(in); err != nil {
		return tool.Preview{}, err
	}

	p := tool.Preview{
		Action: "manage_instrument." + string(in.Action),
		Target: "Instrument " + in.Code,
	}
	switch in.Action {
	case "define":
		return previewDefine(ctx, svc, in, p)
	case "rename":
		return previewRename(ctx, svc, in, p)
	case "edit":
		return previewEdit(ctx, svc, in, p)
	case "record_price":
		return previewRecordPrice(ctx, svc, in, p)
	case "delete":
		return previewDelete(ctx, svc, in, p)
	case "request_history":
		if _, err := svc.Instrument(ctx, in.Code); err != nil {
			return tool.Preview{}, err
		}

		p.Changes = []tool.Change{{Field: "from", After: tool.DateValue(in.From.Time)}}
	case "set_terms":
		return previewSetTerms(ctx, svc, in, p)
	}

	return p, nil
}

func previewDefine(
	ctx context.Context,
	svc Service,
	in manageInstrumentIn,
	p tool.Preview,
) (tool.Preview, error) {
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

	if q, err := svc.Instrument(
		ctx,
		in.QuoteCurrency,
	); err != nil ||
		q.Type != domain.TypeCurrency {
		return tool.Preview{}, &domain.FieldError{
			Field:   "quote_currency",
			Message: "must be a currency",
		}
	}

	p.Changes = []tool.Change{
		{Field: "instrument", After: tool.TextValue(string(def.Code))},
		{Field: "name", After: tool.TextValue(def.Name)},
		{Field: "kind", After: tool.TextValue(def.Type)},
		{Field: "currency", After: tool.TextValue(string(def.QuoteCurrency))},
	}
	p.Changes = append(p.Changes, instrumentFactChanges(domain.Instrument{}, def)...)

	return p, nil
}

func previewRename(
	ctx context.Context,
	svc Service,
	in manageInstrumentIn,
	p tool.Preview,
) (tool.Preview, error) {
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

	p.Changes = []tool.Change{
		{Field: "name", Before: tool.TextValue(before), After: tool.TextValue(inst.Name)},
	}

	return p, nil
}

func previewEdit(
	ctx context.Context,
	svc Service,
	in manageInstrumentIn,
	p tool.Preview,
) (tool.Preview, error) {
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

	return p, nil
}

func previewRecordPrice(
	ctx context.Context,
	svc Service,
	in manageInstrumentIn,
	p tool.Preview,
) (tool.Preview, error) {
	inst, err := svc.Instrument(ctx, in.Code)
	if err != nil {
		return tool.Preview{}, err
	}

	if inst.QuoteCurrency == "" {
		return tool.Preview{}, tool.InvalidArgument(
			"code",
			"has no quote currency; prices belong to securities",
		)
	}

	if _, err := parsePrice(in.Price); err != nil {
		return tool.Preview{}, err
	}

	p.Changes = []tool.Change{
		{Field: "price", After: tool.TextValue(in.Price + " " + string(inst.QuoteCurrency))},
		{Field: "date", After: tool.DateValue(in.Date.Time)},
	}

	return p, nil
}

func previewDelete(
	ctx context.Context,
	svc Service,
	in manageInstrumentIn,
	p tool.Preview,
) (tool.Preview, error) {
	inst, err := svc.Instrument(ctx, in.Code)
	if err != nil {
		return tool.Preview{}, err
	}

	if inst.Type == domain.TypeCurrency {
		return tool.Preview{}, &domain.FieldError{Field: "code", Message: "is a currency"}
	}

	p.Destructive = true
	p.Changes = []tool.Change{
		{Field: "instrument", Before: tool.TextValue(string(inst.Code) + " " + inst.Name)},
	}

	return p, nil
}

func previewSetTerms(
	ctx context.Context,
	svc Service,
	in manageInstrumentIn,
	p tool.Preview,
) (tool.Preview, error) {
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
		return tool.Preview{}, &domain.FieldError{
			Field:   "code",
			Message: "terms belong to a fixed_income instrument",
		}
	}

	change := tool.Change{Field: "terms", After: tool.TextValue(termsText(t))}
	if old, err := svc.Terms(ctx, in.Code); err == nil {
		change.Before = tool.TextValue(termsText(old))
	}

	p.Changes = []tool.Change{change}

	return p, nil
}
