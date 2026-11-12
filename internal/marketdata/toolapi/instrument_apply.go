package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func applyInstrument(
	ctx context.Context,
	svc Service,
	in manageInstrumentIn,
) (manageInstrumentOut, error) {
	if err := checkInstrumentArgs(in); err != nil {
		return manageInstrumentOut{}, err
	}

	switch in.Action {
	case "define":
		return applyDefine(ctx, svc, in)
	case "edit":
		return applyEdit(ctx, svc, in)
	case "rename":
		return applyRename(ctx, svc, in)
	case "record_price":
		return applyRecordPrice(ctx, svc, in)
	case "delete":
		return manageInstrumentOut{}, svc.DeleteInstrument(ctx, in.Code)
	case "request_history":
		return applyRequestHistory(ctx, svc, in)
	}

	return applySetTerms(ctx, svc, in)
}

func applyDefine(
	ctx context.Context,
	svc Service,
	in manageInstrumentIn,
) (manageInstrumentOut, error) {
	def, err := in.instrument()
	if err != nil {
		return manageInstrumentOut{}, err
	}

	def, err = svc.DefineInstrument(ctx, def)

	return manageInstrumentOut{Instrument: toInstrumentView(def)}, err
}

func applyEdit(
	ctx context.Context,
	svc Service,
	in manageInstrumentIn,
) (manageInstrumentOut, error) {
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

	after, err = svc.EditInstrument(
		ctx,
		in.Code,
		after.Name,
		after.Exchange,
		after.Subtype,
		in.symbolsForEdit(after),
	)

	return manageInstrumentOut{Instrument: toInstrumentView(after)}, err
}

func applyRename(
	ctx context.Context,
	svc Service,
	in manageInstrumentIn,
) (manageInstrumentOut, error) {
	inst, err := svc.Instrument(ctx, in.Code)
	if err != nil {
		return manageInstrumentOut{}, err
	}

	inst, err = svc.EditInstrument(ctx, in.Code, in.Name, inst.Exchange, inst.Subtype, nil)

	return manageInstrumentOut{Instrument: toInstrumentView(inst)}, err
}

func applyRecordPrice(
	ctx context.Context,
	svc Service,
	in manageInstrumentIn,
) (manageInstrumentOut, error) {
	inst, err := svc.Instrument(ctx, in.Code)
	if err != nil {
		return manageInstrumentOut{}, err
	}

	if inst.QuoteCurrency == "" {
		return manageInstrumentOut{}, tool.InvalidArgument(
			"code",
			"has no quote currency; prices belong to securities",
		)
	}

	v, err := parsePrice(in.Price)
	if err != nil {
		return manageInstrumentOut{}, err
	}

	err = svc.RecordPrices(ctx, []domain.Price{{
		Instrument: inst.Code,
		Quote:      inst.QuoteCurrency,
		Date:       in.Date.Time,
		Value:      v,
		Source:     domain.SourceManual,
	}})

	return manageInstrumentOut{Price: priceView{Date: in.Date, Value: v.Reduced().String()}}, err
}

func applyRequestHistory(
	ctx context.Context,
	svc Service,
	in manageInstrumentIn,
) (manageInstrumentOut, error) {
	if err := svc.RequestHistory(ctx, in.Code, in.From.Time); err != nil {
		return manageInstrumentOut{}, err
	}

	inst, err := svc.Instrument(ctx, in.Code)

	return manageInstrumentOut{Instrument: toInstrumentView(inst)}, err
}

func applySetTerms(
	ctx context.Context,
	svc Service,
	in manageInstrumentIn,
) (manageInstrumentOut, error) {
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
}
