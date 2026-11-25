package httpapi

import (
	"context"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

func (s *Server) getPortfolioProjection(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (ProjectionPlan, error) {
	view, err := s.svc.Projection(ctx, auth.MustBooksID(ctx), auth.MustMemberID(ctx))
	if err != nil {
		return ProjectionPlan{}, err
	}

	return projectionPlan(view), nil
}

func (s *Server) savePortfolioProjection(
	ctx context.Context,
	_ *http.Request,
	in ProjectionPlanInput,
) (ProjectionPlan, error) {
	view, err := s.svc.SaveProjection(
		ctx,
		auth.MustBooksID(ctx),
		auth.MustMemberID(ctx),
		projection(in),
	)
	if err != nil {
		return ProjectionPlan{}, err
	}

	return projectionPlan(view), nil
}

func (s *Server) deletePortfolioProjection(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	err := s.svc.DeleteProjection(ctx, auth.MustBooksID(ctx), auth.MustMemberID(ctx))

	return httpserver.None{}, err
}

func projection(in ProjectionPlanInput) domain.Projection {
	p := domain.Projection{
		WithdrawalAge: in.WithdrawalAge,
		LastAge:       in.LastAge,
		RealReturnBP:  in.RealReturnBp,
		InflationBP:   in.InflationBp,
		Mode:          string(in.Withdrawal.Mode),
		Changes:       make([]domain.ProjectionChange, len(in.Changes)),

		WithdrawalReturnBP: in.WithdrawalReturnBp,
		CautiousReturnBP:   in.CautiousReturnBp,
		FavorableReturnBP:  in.FavorableReturnBp,
		GainTaxBP:          in.GainTaxBp,
	}

	if in.Withdrawal.Income != nil {
		p.Income = *in.Withdrawal.Income
	}

	if in.Withdrawal.RateBp != nil {
		p.RateBP = *in.Withdrawal.RateBp
	}

	for i, c := range in.Changes {
		p.Changes[i] = domain.ProjectionChange{Month: c.Month.Time, Amount: c.Amount}
	}

	if in.Incomes == nil {
		return p
	}

	for _, i := range *in.Incomes {
		p.Incomes = append(p.Incomes, domain.ProjectionIncome{
			Name:     i.Name,
			Amount:   i.Amount,
			StartAge: i.StartAge,
			EndAge:   i.EndAge,
		})
	}

	return p
}

func projectionPlan(v app.ProjectionView) ProjectionPlan {
	w := ProjectionWithdrawal{Mode: ProjectionWithdrawalMode(v.Mode)}
	if v.Mode == domain.ModeIncome {
		w.Income = &v.Income
	} else {
		w.RateBp = &v.RateBP
	}

	out := ProjectionPlan{
		WithdrawalAge: v.WithdrawalAge,
		LastAge:       v.LastAge,
		RealReturnBp:  v.RealReturnBP,
		InflationBp:   v.InflationBP,
		Withdrawal:    w,
		Changes:       make([]ProjectionChange, len(v.Changes)),
		Incomes:       make([]ProjectionIncome, len(v.Incomes)),
		Currency:      string(v.Currency),
		Baseline: ProjectionBaseline{
			Date:  openapi_types.Date{Time: v.BaselineDate},
			Value: v.BaselineValue,
		},

		WithdrawalReturnBp: v.WithdrawalReturnBP,
		CautiousReturnBp:   v.CautiousReturnBP,
		FavorableReturnBp:  v.FavorableReturnBP,
		GainTaxBp:          v.GainTaxBP,
	}

	for i, c := range v.Changes {
		out.Changes[i] = ProjectionChange{
			Month:  openapi_types.Date{Time: c.Month},
			Amount: c.Amount,
		}
	}

	for i, income := range v.Incomes {
		out.Incomes[i] = ProjectionIncome{
			Name:     income.Name,
			Amount:   income.Amount,
			StartAge: income.StartAge,
			EndAge:   income.EndAge,
		}
	}

	return out
}
