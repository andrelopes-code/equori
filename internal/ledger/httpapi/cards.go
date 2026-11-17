package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
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

func (s *Server) listBillingCycleRules(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (BillingCycleRuleList, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return BillingCycleRuleList{}, err
	}

	rules, err := s.svc.BillingRules(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return BillingCycleRuleList{}, err
	}

	out := BillingCycleRuleList{Items: make([]BillingCycleRule, len(rules))}
	for i, rec := range rules {
		out.Items[i] = toBillingRuleAPI(rec)
	}

	return out, nil
}

func (s *Server) createBillingCycleRule(
	ctx context.Context,
	r *http.Request,
	in CreateBillingCycleRuleJSONRequestBody,
) (BillingCycleRule, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return BillingCycleRule{}, err
	}

	b := in

	rec, err := billingRuleFromInput(b)
	if err != nil {
		return BillingCycleRule{}, err
	}

	created, err := s.svc.AddBillingRule(ctx, auth.MustBooksID(ctx), id, rec)
	if err != nil {
		return BillingCycleRule{}, err
	}

	return toBillingRuleAPI(created), nil
}

func billingRuleFromInput(
	b CreateBillingCycleRuleJSONRequestBody,
) (domain.BillingCycleRule, error) {
	from, err := domain.ParseReferenceMonth(b.EffectiveFrom)
	if err != nil {
		return domain.BillingCycleRule{}, &domain.FieldError{
			Field:   "effective_from",
			Message: "must be YYYY-MM",
			Err:     domain.ErrValidation,
		}
	}

	rec := domain.BillingCycleRule{
		EffectiveFrom: from,
		DueDay:        b.DueDay,
		Calendar:      optString(b.Calendar),
	}
	if b.ClosingDay != nil {
		rec.ClosingDay = *b.ClosingDay
	}

	if b.ClosingMode != nil {
		rec.ClosingMode = string(*b.ClosingMode)
	}

	if b.ClosingDaysBeforeDue != nil {
		rec.ClosingDaysBeforeDue = *b.ClosingDaysBeforeDue
	}

	if b.ClosingAdjustment != nil {
		rec.ClosingAdjustment = string(*b.ClosingAdjustment)
	}

	if b.ClosingDayAssignment != nil {
		rec.Assignment = string(*b.ClosingDayAssignment)
	}

	if b.DueDateAdjustment != nil {
		rec.Adjustment = string(*b.DueDateAdjustment)
	}

	return rec, nil
}

func (s *Server) listCreditLimits(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (CreditLimitList, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return CreditLimitList{}, err
	}

	limits, err := s.svc.CreditLimits(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return CreditLimitList{}, err
	}

	out := CreditLimitList{Items: make([]CreditLimit, len(limits))}
	for i, l := range limits {
		out.Items[i] = CreditLimit{
			EffectiveFrom: apiDate(l.EffectiveFrom),
			Amount:        toMoneyAPI(l.Amount),
		}
	}

	return out, nil
}

func (s *Server) createCreditLimit(
	ctx context.Context,
	r *http.Request,
	in CreateCreditLimitJSONRequestBody,
) (CreditLimit, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return CreditLimit{}, err
	}

	amount, err := fromMoneyAPI("amount", in.Amount)
	if err != nil {
		return CreditLimit{}, err
	}

	l, err := s.svc.AddCreditLimit(
		ctx,
		auth.MustBooksID(ctx),
		app.CreditLimit{AccountID: id, EffectiveFrom: dateOf(in.EffectiveFrom), Amount: amount},
	)
	if err != nil {
		return CreditLimit{}, err
	}

	return CreditLimit{EffectiveFrom: apiDate(l.EffectiveFrom), Amount: toMoneyAPI(l.Amount)}, nil
}

func toCardAPI(c domain.Card) Card {
	virtual := c.Virtual

	var network *string
	if c.Network != "" {
		network = &c.Network
	}

	return Card{
		Id:              c.ID,
		Network:         network,
		Holder:          c.Holder,
		LastFour:        c.LastFour,
		Virtual:         &virtual,
		Active:          c.Active,
		ForeignChargeBp: c.ForeignChargeBP,
	}
}

func (s *Server) listCards(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (CardList, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return CardList{}, err
	}

	cards, err := s.svc.Cards(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return CardList{}, err
	}

	out := CardList{Items: make([]Card, len(cards))}
	for i, c := range cards {
		out.Items[i] = toCardAPI(c)
	}

	return out, nil
}

func (s *Server) createCard(
	ctx context.Context,
	r *http.Request,
	in CreateCardJSONRequestBody,
) (Card, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Card{}, err
	}

	virtual := in.Virtual != nil && *in.Virtual

	c, err := s.svc.AddCard(
		ctx,
		auth.MustBooksID(ctx),
		domain.Card{
			AccountID: id,
			Holder:    in.Holder,
			LastFour:  in.LastFour,
			Virtual:   virtual,
			Network:   optString(in.Network),
		},
		in.ForeignChargeBp,
	)
	if err != nil {
		return Card{}, err
	}

	return toCardAPI(c), nil
}

func (s *Server) updateCard(
	ctx context.Context,
	r *http.Request,
	in UpdateCardJSONRequestBody,
) (Card, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Card{}, err
	}

	b := in

	c, err := s.svc.EditCard(
		ctx,
		auth.MustBooksID(ctx),
		id,
		domain.CardEdit{
			Holder:   b.Holder,
			LastFour: b.LastFour,
			Active:   b.Active,
			Network:  b.Network,
		},
	)
	if err != nil {
		return Card{}, err
	}

	return toCardAPI(c), nil
}

func (s *Server) deleteCard(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.DeleteCard(ctx, auth.MustBooksID(ctx), id); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}
