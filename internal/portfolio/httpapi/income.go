package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) listRealizedResults(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (RealizedResultList, error) {
	params, err := httpserver.Query[ListRealizedResultsParams](r)
	if err != nil {
		return RealizedResultList{}, err
	}

	booksID := auth.MustBooksID(ctx)

	from, to, err := s.svc.TaxYear(ctx, booksID, params.Year)
	if err != nil {
		return RealizedResultList{}, err
	}

	rs, err := s.svc.RealizedResults(ctx, booksID, params.Year)
	if err != nil {
		return RealizedResultList{}, err
	}

	items := make([]RealizedResult, len(rs))
	for i, r := range rs {
		items[i] = RealizedResult{
			TransactionId: r.TransactionID,
			AccountId:     r.AccountID,
			Instrument:    string(r.Instrument),
			Date:          date(r.Date),
			Month: r.Month.Format(
				"2006-01",
			),
			Quantity: toMoney(r.QuantityAmount),
			Cost:     toMoney(r.CostAmount),
			Proceeds: toMoney(
				r.Proceeds,
			),
			Result:   toMoney(r.ResultAmount),
			Kind:     RealizedResultKind(r.Kind),
			TaxClass: optional(r.TaxClass),
		}
	}

	return RealizedResultList{From: date(from), To: date(to.AddDate(0, 0, -1)), Items: items}, nil
}

func (s *Server) listIncomeEvents(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (IncomeEventList, error) {
	params, err := httpserver.Query[ListIncomeEventsParams](r)
	if err != nil {
		return IncomeEventList{}, err
	}

	booksID := auth.MustBooksID(ctx)

	from, to, err := s.svc.TaxYear(ctx, booksID, params.Year)
	if err != nil {
		return IncomeEventList{}, err
	}

	es, err := s.svc.IncomeEvents(ctx, booksID, params.Year)
	if err != nil {
		return IncomeEventList{}, err
	}

	items := make([]IncomeEvent, len(es))
	for i, e := range es {
		items[i] = IncomeEvent{
			TransactionId: e.TransactionID,
			AccountId:     e.AccountID,
			Instrument:    string(e.Instrument),
			Date:          date(e.Date),
			IncomeType:    IncomeType(e.Type),
			TaxTreatment:  optional(e.TaxTreatment),
			Gross:         toMoney(e.GrossAmount),
			Withheld:      toMoney(e.WithheldAmount),
		}
	}

	return IncomeEventList{From: date(from), To: date(to.AddDate(0, 0, -1)), Items: items}, nil
}

func (s *Server) listInvestmentIncomeTypes(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (IncomeTypeList, error) {
	types, err := s.svc.IncomeTypes(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return IncomeTypeList{}, err
	}

	items := make([]IncomeType, len(types))
	for i, t := range types {
		items[i] = IncomeType(t)
	}

	return IncomeTypeList{Items: items}, nil
}
