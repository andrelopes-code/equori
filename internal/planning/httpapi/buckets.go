package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) saveBudgetBuckets(
	ctx context.Context,
	_ *http.Request,
	in SaveBudgetBucketsJSONRequestBody,
) (httpserver.None, error) {
	buckets := make([]domain.Bucket, len(in.Buckets))
	for i, b := range in.Buckets {
		buckets[i] = domain.Bucket{
			Name:         b.Name,
			ShareBP:      b.ShareBp,
			TakesSavings: b.TakesSavings,
			Categories:   b.CategoryIds,
		}
	}

	return httpserver.None{}, s.svc.SaveBudgetBuckets(ctx, auth.MustBooksID(ctx), buckets)
}

func (s *Server) getBudgetBuckets(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (BudgetBuckets, error) {
	method, err := s.svc.BudgetBuckets(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return BudgetBuckets{}, err
	}

	out := BudgetBuckets{Buckets: make([]BudgetBucket, len(method))}
	for i, b := range method {
		out.Buckets[i] = BudgetBucket{
			Id:           b.ID,
			Name:         b.Name,
			ShareBp:      b.ShareBP,
			TakesSavings: b.TakesSavings,
			CategoryIds:  b.Categories,
		}
	}

	return out, nil
}

// setPlanBuckets adds the bucket method and its figures (A230); nothing without a method.
func setPlanBuckets(out *BudgetPlan, p app.Plan, m func(int64) Money) {
	if len(p.Buckets) == 0 {
		return
	}

	targets, hasTargets := p.BucketTargets()

	buckets := make([]BudgetPlanBucket, len(p.Buckets))
	for i, b := range p.Buckets {
		buckets[i] = BudgetPlanBucket{
			Id:           b.ID,
			Name:         b.Name,
			ShareBp:      b.ShareBP,
			TakesSavings: b.TakesSavings,
			CategoryIds:  b.Categories,
			Planned:      m(b.Planned),
			Spent:        m(b.Spent),
		}
		if hasTargets {
			target := m(targets[i])
			buckets[i].Target = &target
		}
	}

	planned, spent := m(p.OutsidePlanned), m(p.OutsideSpent)
	out.Buckets, out.OutsidePlanned, out.OutsideSpent = &buckets, &planned, &spent
}
