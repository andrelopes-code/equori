package httpapi

import (
	"context"
	"net/http"
	"time"

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
	var from *time.Time

	if in.From != nil {
		month, err := parseMonth("from", *in.From)
		if err != nil {
			return httpserver.None{}, err
		}

		from = &month
	}

	buckets := make([]domain.Bucket, len(in.Buckets))
	for i, b := range in.Buckets {
		buckets[i] = domain.Bucket{
			Name:         b.Name,
			ShareBP:      b.ShareBp,
			TakesSavings: b.TakesSavings,
			TakesGoals:   b.TakesGoals != nil && *b.TakesGoals,
			AtLeast:      b.AtLeast != nil && *b.AtLeast,
			Categories:   b.CategoryIds,
		}
		if b.Id != nil {
			buckets[i].ID = *b.Id
		}
	}

	return httpserver.None{}, s.svc.SaveBudgetBuckets(ctx, auth.MustBooksID(ctx), from, buckets)
}

func (s *Server) getBudgetBuckets(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (BudgetBuckets, error) {
	params, err := httpserver.Query[GetBudgetBucketsParams](r)
	if err != nil {
		return BudgetBuckets{}, err
	}

	var month *time.Time

	if params.Month != nil {
		m, err := parseMonth("month", *params.Month)
		if err != nil {
			return BudgetBuckets{}, err
		}

		month = &m
	}

	method, err := s.svc.BudgetBuckets(ctx, auth.MustBooksID(ctx), month)
	if err != nil {
		return BudgetBuckets{}, err
	}

	out := BudgetBuckets{Buckets: make([]BudgetBucket, len(method.Buckets))}
	if !method.From.IsZero() {
		from := method.From.Format(monthLayout)
		out.From = &from
	}

	for i, b := range method.Buckets {
		out.Buckets[i] = BudgetBucket{
			Id:           b.ID,
			Name:         b.Name,
			ShareBp:      b.ShareBP,
			TakesSavings: b.TakesSavings,
			TakesGoals:   b.TakesGoals,
			AtLeast:      b.AtLeast,
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
			TakesGoals:   b.TakesGoals,
			AtLeast:      b.AtLeast,
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
	out.OutsideCategoryIds = &p.OutsideCategories
}

func (s *Server) getBudgetBucketHistory(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (BudgetBucketHistory, error) {
	params, err := httpserver.Query[GetBudgetBucketHistoryParams](r)
	if err != nil {
		return BudgetBucketHistory{}, err
	}

	month, err := parseMonth("month", params.Month)
	if err != nil {
		return BudgetBucketHistory{}, err
	}

	h, err := s.svc.BucketHistory(ctx, auth.MustBooksID(ctx), month)
	if err != nil {
		return BudgetBucketHistory{}, err
	}

	return toBucketHistoryAPI(h), nil
}

func toBucketHistoryAPI(h app.BucketHistory) BudgetBucketHistory {
	m := func(amount int64) Money { return toMoneyAPI(amount, h.Currency) }
	out := BudgetBucketHistory{
		Currency: string(h.Currency),
		Methods:  make([]BudgetBucketVersion, len(h.Methods)),
		Months:   make([]BudgetBucketMonth, len(h.Months)),
	}

	for i, method := range h.Methods {
		out.Methods[i] = toBucketVersionAPI(method)
	}

	buckets := make(map[time.Time][]domain.Bucket, len(h.Methods))
	for _, method := range h.Methods {
		buckets[method.From] = method.Buckets
	}

	for i, month := range h.Months {
		reals := make([]BudgetBucketReal, len(month.Real))
		for j, real := range month.Real {
			b := buckets[month.From][j]
			reals[j] = BudgetBucketReal{
				Id:       b.ID,
				Real:     m(real),
				GoalPaid: m(month.GoalPaid[j]),
				Covered:  m(month.Covered[j]),
			}

			if b.TakesGoals {
				deposited, withdrawn := m(month.Deposited), m(month.Withdrawn)
				reals[j].Deposited, reals[j].Withdrawn = &deposited, &withdrawn
			}
		}

		out.Months[i] = BudgetBucketMonth{
			Month:       month.Month.Format(monthLayout),
			Received:    m(month.Received),
			Outside:     m(month.Outside),
			Unallocated: m(month.Unallocated),
			Retained:    m(month.Retained),
			Buckets:     reals,
		}

		if month.HasMethod {
			from := month.From.Format(monthLayout)
			out.Months[i].From = &from
		}
	}

	return out
}

func toBucketVersionAPI(method domain.Method) BudgetBucketVersion {
	out := BudgetBucketVersion{
		From:    method.From.Format(monthLayout),
		Buckets: make([]BudgetBucket, len(method.Buckets)),
	}

	for i, b := range method.Buckets {
		out.Buckets[i] = BudgetBucket{
			Id:           b.ID,
			Name:         b.Name,
			ShareBp:      b.ShareBP,
			TakesSavings: b.TakesSavings,
			TakesGoals:   b.TakesGoals,
			AtLeast:      b.AtLeast,
			CategoryIds:  b.Categories,
		}
	}

	return out
}
