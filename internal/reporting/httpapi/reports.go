package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/reporting/app"
)

func (s *Server) getBalanceSeries(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (BalanceSeries, error) {
	params, err := httpserver.Query[GetBalanceSeriesParams](r)
	if err != nil {
		return BalanceSeries{}, err
	}

	basis := app.BasisBooked
	if params.Basis != nil {
		basis = app.Basis(*params.Basis)
	}

	points, currency, err := s.svc.Series(
		ctx,
		auth.MustBooksID(ctx),
		params.AccountId,
		params.From.Time,
		params.To.Time,
		basis,
	)
	if err != nil {
		return BalanceSeries{}, err
	}

	out := BalanceSeries{Items: make([]BalancePoint, len(points))}
	for i, p := range points {
		out.Items[i] = BalancePoint{
			Date:    dateOf(p),
			Balance: Money{Amount: p.Balance, Currency: currency},
		}
	}

	return out, nil
}

func (s *Server) getAccountFlows(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (AccountFlows, error) {
	params, err := httpserver.Query[GetAccountFlowsParams](r)
	if err != nil {
		return AccountFlows{}, err
	}

	flows, instrument, err := s.svc.Flows(
		ctx,
		auth.MustBooksID(ctx),
		params.AccountId,
		params.From.Time,
		params.To.Time,
	)
	if err != nil {
		return AccountFlows{}, err
	}

	out := AccountFlows{Items: make([]FlowDay, len(flows))}
	for i, f := range flows {
		out.Items[i] = FlowDay{
			Date: flowDate(
				f,
			),
			Inflow:  Money{Amount: f.Inflow, Currency: instrument},
			Outflow: Money{Amount: f.Outflow, Currency: instrument},
		}
	}

	return out, nil
}

func (s *Server) getCategoryTotals(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (CategoryTotals, error) {
	params, err := httpserver.Query[GetCategoryTotalsParams](r)
	if err != nil {
		return CategoryTotals{}, err
	}

	view := app.ViewAccrual
	if params.View != nil {
		view = app.View(*params.View)
	}

	totals, err := s.svc.CategoryTotals(
		ctx,
		auth.MustBooksID(ctx),
		string(params.Class),
		params.From.Time,
		params.To.Time,
		view,
	)
	if err != nil {
		return CategoryTotals{}, err
	}

	out := CategoryTotals{Items: make([]CategoryTotal, len(totals))}
	for i, t := range totals {
		out.Items[i] = CategoryTotal{
			AccountId:    t.AccountID,
			Total:        Money{Amount: t.Total, Currency: t.Instrument},
			SubtreeTotal: Money{Amount: t.SubtreeTotal, Currency: t.Instrument},
		}
	}

	return out, nil
}

func (s *Server) listCategoryCashPayments(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (CategoryCashPayments, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return CategoryCashPayments{}, err
	}

	params, err := httpserver.Query[ListCategoryCashPaymentsParams](r)
	if err != nil {
		return CategoryCashPayments{}, err
	}

	payments, instrument, err := s.svc.CategoryCashPayments(
		ctx,
		auth.MustBooksID(ctx),
		id,
		params.From.Time,
		params.To.Time,
	)
	if err != nil {
		return CategoryCashPayments{}, err
	}

	out := CategoryCashPayments{Items: make([]CategoryCashPayment, len(payments))}
	for i, p := range payments {
		out.Items[i] = CategoryCashPayment{
			Date:                 cashDate(p),
			Amount:               Money{Amount: p.Amount, Currency: instrument},
			CardAccountId:        p.CardID,
			StatementId:          p.StatementID,
			StatementReference:   p.StatementReference.Format("2006-01"),
			PaymentTransactionId: p.PaymentTransactionID,
		}
	}

	return out, nil
}
