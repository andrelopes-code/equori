package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func toBillingRuleAPI(r domain.BillingCycleRule) BillingCycleRule {
	assignment := BillingCycleRuleClosingDayAssignment(r.Assignment)
	adjustment := BillingCycleRuleDueDateAdjustment(r.Adjustment)
	calendar := r.Calendar
	mode := BillingCycleRuleClosingMode(r.ClosingMode)
	closingAdjustment := BillingCycleRuleClosingAdjustment(r.ClosingAdjustment)
	out := BillingCycleRule{
		EffectiveFrom: r.EffectiveFrom.String(), DueDay: r.DueDay,
		ClosingDayAssignment: &assignment, DueDateAdjustment: &adjustment, Calendar: &calendar,
		ClosingMode: &mode, ClosingAdjustment: &closingAdjustment,
	}
	if r.ClosingMode == domain.ClosingBeforeDue {
		days := r.ClosingDaysBeforeDue
		out.ClosingDaysBeforeDue = &days
	} else {
		day := r.ClosingDay
		out.ClosingDay = &day
	}
	return out
}

func (s *Server) ListBillingCycleRules(ctx context.Context, req ListBillingCycleRulesRequestObject) (ListBillingCycleRulesResponseObject, error) {
	rules, err := s.svc.BillingRules(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	out := ListBillingCycleRules200JSONResponse{Items: make([]BillingCycleRule, len(rules))}
	for i, r := range rules {
		out.Items[i] = toBillingRuleAPI(r)
	}
	return out, nil
}

func (s *Server) CreateBillingCycleRule(ctx context.Context, req CreateBillingCycleRuleRequestObject) (CreateBillingCycleRuleResponseObject, error) {
	b := req.Body
	from, err := domain.ParseReferenceMonth(b.EffectiveFrom)
	if err != nil {
		return nil, &domain.FieldError{Field: "effective_from", Message: "must be YYYY-MM", Err: domain.ErrValidation}
	}
	r := domain.BillingCycleRule{EffectiveFrom: from, DueDay: b.DueDay, Calendar: optString(b.Calendar)}
	if b.ClosingDay != nil {
		r.ClosingDay = *b.ClosingDay
	}
	if b.ClosingMode != nil {
		r.ClosingMode = string(*b.ClosingMode)
	}
	if b.ClosingDaysBeforeDue != nil {
		r.ClosingDaysBeforeDue = *b.ClosingDaysBeforeDue
	}
	if b.ClosingAdjustment != nil {
		r.ClosingAdjustment = string(*b.ClosingAdjustment)
	}
	if b.ClosingDayAssignment != nil {
		r.Assignment = string(*b.ClosingDayAssignment)
	}
	if b.DueDateAdjustment != nil {
		r.Adjustment = string(*b.DueDateAdjustment)
	}
	created, err := s.svc.AddBillingRule(ctx, auth.MustUserID(ctx), req.Id, r)
	if err != nil {
		return nil, err
	}
	return CreateBillingCycleRule201JSONResponse(toBillingRuleAPI(created)), nil
}

func (s *Server) ListCreditLimits(ctx context.Context, req ListCreditLimitsRequestObject) (ListCreditLimitsResponseObject, error) {
	limits, err := s.svc.CreditLimits(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	out := ListCreditLimits200JSONResponse{Items: make([]CreditLimit, len(limits))}
	for i, l := range limits {
		out.Items[i] = CreditLimit{EffectiveFrom: apiDate(l.EffectiveFrom), Amount: toMoneyAPI(l.Amount)}
	}
	return out, nil
}

func (s *Server) CreateCreditLimit(ctx context.Context, req CreateCreditLimitRequestObject) (CreateCreditLimitResponseObject, error) {
	amount, err := fromMoneyAPI("amount", req.Body.Amount)
	if err != nil {
		return nil, err
	}
	l, err := s.svc.AddCreditLimit(ctx, auth.MustUserID(ctx), app.CreditLimit{AccountID: req.Id, EffectiveFrom: dateOf(req.Body.EffectiveFrom), Amount: amount})
	if err != nil {
		return nil, err
	}
	return CreateCreditLimit201JSONResponse{EffectiveFrom: apiDate(l.EffectiveFrom), Amount: toMoneyAPI(l.Amount)}, nil
}

func toCardAPI(c domain.Card) Card {
	virtual := c.Virtual
	return Card{Id: c.ID, Holder: c.Holder, LastFour: c.LastFour, Virtual: &virtual, Active: c.Active}
}

func (s *Server) ListCards(ctx context.Context, req ListCardsRequestObject) (ListCardsResponseObject, error) {
	cards, err := s.svc.Cards(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	out := ListCards200JSONResponse{Items: make([]Card, len(cards))}
	for i, c := range cards {
		out.Items[i] = toCardAPI(c)
	}
	return out, nil
}

func (s *Server) CreateCard(ctx context.Context, req CreateCardRequestObject) (CreateCardResponseObject, error) {
	virtual := req.Body.Virtual != nil && *req.Body.Virtual
	c, err := s.svc.AddCard(ctx, auth.MustUserID(ctx), domain.Card{AccountID: req.Id, Holder: req.Body.Holder, LastFour: req.Body.LastFour, Virtual: virtual})
	if err != nil {
		return nil, err
	}
	return CreateCard201JSONResponse(toCardAPI(c)), nil
}

func (s *Server) UpdateCard(ctx context.Context, req UpdateCardRequestObject) (UpdateCardResponseObject, error) {
	c, err := s.svc.SetCardActive(ctx, auth.MustUserID(ctx), req.Id, req.Body.Active)
	if err != nil {
		return nil, err
	}
	return UpdateCard200JSONResponse(toCardAPI(c)), nil
}
