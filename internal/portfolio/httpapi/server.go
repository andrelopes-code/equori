// Package httpapi serves the portfolio operations of api/openapi.yaml.
package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/problem"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

const BaseURL = "/api/v1"

type Server struct {
	svc  *app.Service
	errs httpserver.ErrorWriter
}

func NewServer(svc *app.Service, log *slog.Logger) *Server {
	return &Server{svc: svc, errs: httpserver.ErrorWriter{Log: log, Map: ToProblem}}
}

// Register lists every route of the portfolio operations; each handler sits in this file.
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET "+BaseURL+"/positions",
		httpserver.Handle(s.errs, http.StatusOK, s.listPositions))
	mux.HandleFunc("GET "+BaseURL+"/realized-results",
		httpserver.Handle(s.errs, http.StatusOK, s.listRealizedResults))
	mux.HandleFunc("GET "+BaseURL+"/income-events",
		httpserver.Handle(s.errs, http.StatusOK, s.listIncomeEvents))
	mux.HandleFunc("GET "+BaseURL+"/investment-income-types",
		httpserver.Handle(s.errs, http.StatusOK, s.listInvestmentIncomeTypes))
	mux.HandleFunc("GET "+BaseURL+"/reports/return",
		httpserver.Handle(s.errs, http.StatusOK, s.getReturn))
	mux.HandleFunc("GET "+BaseURL+"/reports/allocation",
		httpserver.Handle(s.errs, http.StatusOK, s.getAllocation))
	mux.HandleFunc("GET "+BaseURL+"/reports/net-worth",
		httpserver.Handle(s.errs, http.StatusOK, s.getNetWorth))
	mux.HandleFunc("GET "+BaseURL+"/reports/net-worth/days",
		httpserver.Handle(s.errs, http.StatusOK, s.getNetWorthDays))
	mux.HandleFunc("GET "+BaseURL+"/instrument-subtypes",
		httpserver.Handle(s.errs, http.StatusOK, s.listInstrumentSubtypes))
}

func (s *Server) listPositions(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (PositionList, error) {
	params, err := httpserver.Query[ListPositionsParams](r)
	if err != nil {
		return PositionList{}, err
	}

	ps, err := s.svc.Positions(
		ctx,
		auth.MustBooksID(ctx),
		params.Date.Time,
		valueIn(params.ValueIn),
	)
	if err != nil {
		return PositionList{}, err
	}

	items := make([]Position, len(ps))
	for i, p := range ps {
		items[i] = Position{
			AccountId:  p.AccountID,
			Instrument: string(p.Instrument),
			Quantity:   toMoney(p.Quantity),
			CostBasis:  toMoney(p.CostBasis),
		}
		if p.AverageCost != nil {
			avg := p.AverageCost.String()
			items[i].AverageCost = &avg
		}

		if p.MarketValue != nil {
			v := toMoney(*p.MarketValue)

			prices := make([]Price, len(p.Prices))
			for j, x := range p.Prices {
				prices[j] = Price{
					Instrument:      string(x.Instrument),
					QuoteInstrument: string(x.Quote),
					Date:            date(x.Date),
					Value:           x.Value.Reduced().String(),
					Source:          x.Source,
				}
			}

			items[i].MarketValue, items[i].Prices = &v, &prices
		}
	}

	warnings, err := s.svc.QuoteWarnings(ctx, auth.MustBooksID(ctx), params.Date.Time)
	if err != nil {
		return PositionList{}, err
	}

	return PositionList{Items: items, QuoteWarnings: quoteWarnings(warnings)}, nil
}

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

func (s *Server) listInstrumentSubtypes(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (SubtypeList, error) {
	params, err := httpserver.Query[ListInstrumentSubtypesParams](r)
	if err != nil {
		return SubtypeList{}, err
	}

	subtypes, err := s.svc.Subtypes(ctx, auth.MustBooksID(ctx), string(params.Type))
	if err != nil {
		return SubtypeList{}, err
	}

	return SubtypeList{Items: subtypes}, nil
}

func (s *Server) getAllocation(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (Allocation, error) {
	params, err := httpserver.Query[GetAllocationParams](r)
	if err != nil {
		return Allocation{}, err
	}

	res, err := s.svc.Allocation(
		ctx,
		auth.MustBooksID(ctx),
		params.Date.Time,
		string(params.By),
		valueIn(params.ValueIn),
	)
	if err != nil {
		return Allocation{}, err
	}

	out := Allocation{Total: toMoney(res.Total), Groups: make([]AllocationGroup, len(res.Groups))}
	for i, g := range res.Groups {
		out.Groups[i] = AllocationGroup{Key: g.Key, Value: toMoney(g.Value), ShareBp: g.ShareBP}
	}

	return out, nil
}

func (s *Server) getNetWorth(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (NetWorth, error) {
	params, err := httpserver.Query[GetNetWorthParams](r)
	if err != nil {
		return NetWorth{}, err
	}

	res, err := s.svc.NetWorth(
		ctx,
		auth.MustBooksID(ctx),
		params.Date.Time,
		valueIn(params.ValueIn),
	)
	if err != nil {
		return NetWorth{}, err
	}

	return NetWorth{
		Assets:      toMoney(res.Assets),
		Liabilities: toMoney(res.Liabilities),
		Net:         toMoney(res.Net),
	}, nil
}

func (s *Server) getNetWorthDays(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (NetWorthDays, error) {
	params, err := httpserver.Query[GetNetWorthDaysParams](r)
	if err != nil {
		return NetWorthDays{}, err
	}

	days, err := s.svc.NetWorthDays(
		ctx,
		auth.MustBooksID(ctx),
		params.From.Time,
		params.To.Time,
		valueIn(params.ValueIn),
	)
	if err != nil {
		return NetWorthDays{}, err
	}

	out := NetWorthDays{Items: make([]NetWorthDay, 0, len(days))}
	for _, d := range days {
		out.Items = append(out.Items, NetWorthDay{
			Date:        date(d.Date),
			Assets:      toMoney(d.Assets),
			Liabilities: toMoney(d.Liabilities),
			Net:         toMoney(d.Net),
		})
	}

	return out, nil
}

// valueIn reads the optional value_in parameter; empty selects the base currency.
func valueIn(p *string) money.Currency {
	if p == nil {
		return ""
	}

	return money.Currency(*p)
}

// optional maps the empty string, the domain's absence of a value, to JSON null.
func optional(s string) *string {
	if s == "" {
		return nil
	}

	return &s
}

func toMoney(
	m money.Money,
) Money {
	return Money{Amount: m.Amount(), Currency: string(m.Currency())}
}

func quoteWarnings(ws []app.QuoteWarning) []PositionQuoteWarning {
	out := make([]PositionQuoteWarning, len(ws))
	for i, w := range ws {
		out[i] = PositionQuoteWarning{Instrument: string(w.Instrument)}
		if w.Last != nil {
			d := date(*w.Last)
			out[i].Last = &d
		}
	}

	return out
}

func date(t time.Time) openapi_types.Date { return openapi_types.Date{Time: t} }

// ToProblem maps the module's errors to the codes declared in api/openapi.yaml (ADR 004);
// the module returns none of its own.
func ToProblem(err error) (problem.Details, bool) {
	switch {
	case errors.Is(err, app.ErrInvalidReturnRange):
		d := problem.New(
			http.StatusBadRequest,
			"invalid_request",
			"from must not be after to, and the period must not exceed 366 days",
		)
		d.Errors = []problem.FieldError{
			{Field: "to", Message: "must be on or after from and at most 365 days after it"},
		}

		return d, true
	case errors.Is(err, app.ErrInvalidDayRange):
		d := problem.New(
			http.StatusBadRequest,
			"invalid_request",
			"from must not be after to, and the range must not exceed 62 days",
		)
		d.Errors = []problem.FieldError{
			{Field: "to", Message: "must be on or after from and at most 61 days after it"},
		}

		return d, true
	case errors.Is(err, app.ErrNotFound):
		return problem.New(http.StatusNotFound, "not_found", "account not found"), true
	case errors.Is(err, app.ErrPriceMissing):
		return problem.New(http.StatusUnprocessableEntity, "price_missing", err.Error()), true
	case errors.Is(err, app.ErrUnknownIndex), errors.Is(err, app.ErrIndexNotDaily):
		d := problem.New(
			http.StatusBadRequest,
			"invalid_request",
			"the index must be an enabled daily index with stored rates",
		)
		d.Errors = []problem.FieldError{
			{Field: "index", Message: "must be an enabled daily index with stored rates"},
		}

		return d, true
	case errors.Is(err, app.ErrReturnUndefined):
		return problem.New(
			http.StatusUnprocessableEntity,
			"return_undefined",
			"no money was invested in the period, or the return has no solution",
		), true
	}

	return problem.Details{}, false
}
