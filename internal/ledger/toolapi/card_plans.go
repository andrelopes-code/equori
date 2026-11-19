package toolapi

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func planAddCard(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a domain.Account,
	in manageCardIn,
	pv tool.Preview,
	out manageCardOut,
) (tool.Preview, func() (manageCardOut, error), error) {
	if !lastFourPattern.MatchString(in.LastFour) {
		return pv, nil, tool.InvalidArgument("last_four", "must be four digits")
	}

	c := domain.Card{
		AccountID: a.ID,
		Holder:    in.Holder,
		LastFour:  in.LastFour,
		Virtual:   in.Virtual,
		Network:   in.Network,
	}

	pv.Changes = []tool.Change{{Field: "card", After: tool.TextValue(cardText(c))}}
	if in.Network != "" {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "network", After: tool.TextValue(in.Network)},
		)
	}

	if in.ForeignChargeBP.Set {
		rate := fmt.Sprintf("%d bp on foreign purchases", in.ForeignChargeBP.N)
		pv.Changes = append(pv.Changes, tool.Change{Field: "rate", After: tool.TextValue(rate)})
	}

	return pv, func() (manageCardOut, error) {
		created, err := svc.AddCard(ctx, booksID, c, optionalBP(in.ForeignChargeBP))
		out.ID = created.ID.String()

		return out, err
	}, nil
}

func planRemoveCard(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a domain.Account,
	cardID uuid.UUID,
	pv tool.Preview,
	out manageCardOut,
) (tool.Preview, func() (manageCardOut, error), error) {
	c, err := cardOf(ctx, svc, booksID, a.ID, cardID)
	if err != nil {
		return pv, nil, err
	}

	pv.Changes = []tool.Change{{Field: "card", Before: tool.TextValue(cardText(c))}}
	pv.Destructive = true

	return pv, func() (manageCardOut, error) {
		out.ID = c.ID.String()

		return out, svc.DeleteCard(ctx, booksID, c.ID)
	}, nil
}

func planSetCardActive(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a domain.Account,
	cardID uuid.UUID,
	in manageCardIn,
	pv tool.Preview,
	out manageCardOut,
) (tool.Preview, func() (manageCardOut, error), error) {
	c, err := cardOf(ctx, svc, booksID, a.ID, cardID)
	if err != nil {
		return pv, nil, err
	}

	status := func(active bool) tool.Value {
		if active {
			return tool.TextValue("active")
		}

		return tool.TextValue("inactive")
	}
	pv.Changes = []tool.Change{
		{Field: "card", After: tool.TextValue(cardText(c))},
		{Field: "status", Before: status(c.Active), After: status(in.Active)},
	}

	return pv, func() (manageCardOut, error) {
		_, err := svc.EditCard(ctx, booksID, c.ID, domain.CardEdit{Active: &in.Active})
		out.ID = c.ID.String()

		return out, err
	}, nil
}

// currentLimit is the limit in force today, or the zero Value when the card has none.
func currentLimit(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	cardID uuid.UUID,
) (tool.Value, error) {
	limits, err := svc.CreditLimits(ctx, booksID, cardID)
	if err != nil {
		return tool.Value{}, err
	}

	today := svc.Today(ctx)

	var current tool.Value
	for _, l := range limits {
		if !l.EffectiveFrom.After(today) {
			current = tool.MoneyValue(l.Amount)
		}
	}

	return current, nil
}

func planSetCreditLimit(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a domain.Account,
	in manageCardIn,
	pv tool.Preview,
	out manageCardOut,
) (tool.Preview, func() (manageCardOut, error), error) {
	unit, err := svc.AmountOf(ctx, 0, a.Instrument)
	if err != nil {
		return pv, nil, err
	}

	amount, err := tool.ParsePositive("amount", in.Amount, unit)
	if err != nil {
		return pv, nil, err
	}

	current, err := currentLimit(ctx, svc, booksID, a.ID)
	if err != nil {
		return pv, nil, err
	}

	pv.Changes = []tool.Change{
		{Field: "limit", Before: current, After: tool.MoneyValue(amount)},
		{Field: "date", After: tool.DateValue(in.EffectiveFrom.Time)},
	}

	return pv, func() (manageCardOut, error) {
		_, err := svc.AddCreditLimit(ctx, booksID, app.CreditLimit{
			AccountID:     a.ID,
			EffectiveFrom: in.EffectiveFrom.Time,
			Amount:        amount,
		})
		out.ID = a.ID.String()

		return out, err
	}, nil
}

func planSetBillingCycle(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a domain.Account,
	in manageCardIn,
	pv tool.Preview,
	out manageCardOut,
) (tool.Preview, func() (manageCardOut, error), error) {
	rule := domain.BillingCycleRule{
		EffectiveFrom: domain.MonthOf(
			in.EffectiveFrom.Time,
		),
		ClosingMode:          string(in.ClosingMode),
		ClosingDay:           in.ClosingDay,
		ClosingDaysBeforeDue: in.ClosingDaysBeforeDue,
		DueDay:               in.DueDay,
		Assignment:           string(in.ClosingDayAssignment),
		Adjustment: string(
			in.DueDateAdjustment,
		),
		ClosingAdjustment: string(in.ClosingAdjustment),
		Calendar:          in.Calendar,
	}
	pv.Changes = cycleChanges(in, rule)

	return pv, func() (manageCardOut, error) {
		_, err := svc.AddBillingRule(ctx, booksID, a.ID, rule)
		out.ID = a.ID.String()

		return out, err
	}, nil
}

func planEditCard(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a domain.Account,
	cardID uuid.UUID,
	in manageCardIn,
	pv tool.Preview,
	out manageCardOut,
) (tool.Preview, func() (manageCardOut, error), error) {
	if in.Holder == "" && in.LastFour == "" && in.Network == "" {
		return pv, nil, tool.InvalidArgument(
			"holder",
			"give at least one of holder, last_four and network",
		)
	}

	c, err := cardOf(ctx, svc, booksID, a.ID, cardID)
	if err != nil {
		return pv, nil, err
	}

	edit := domain.CardEdit{}
	if in.Holder != "" {
		edit.Holder = &in.Holder
	}

	if in.LastFour != "" {
		if !lastFourPattern.MatchString(in.LastFour) {
			return pv, nil, tool.InvalidArgument("last_four", "must be four digits")
		}

		edit.LastFour = &in.LastFour
	}

	after := c
	if edit.Holder != nil {
		after.Holder = *edit.Holder
	}

	if edit.LastFour != nil {
		after.LastFour = *edit.LastFour
	}

	pv.Changes = []tool.Change{
		{
			Field:  "card",
			Before: tool.TextValue(cardText(c)),
			After:  tool.TextValue(cardText(after)),
		},
	}
	if in.Network != "" {
		edit.Network = &in.Network
		pv.Changes = append(pv.Changes, tool.Change{
			Field:  "network",
			Before: tool.TextValue(c.Network),
			After:  tool.TextValue(in.Network),
		})
	}

	return pv, func() (manageCardOut, error) {
		_, err := svc.EditCard(ctx, booksID, c.ID, edit)
		out.ID = c.ID.String()

		return out, err
	}, nil
}

// cardOf returns the card of the account, or app.ErrNotFound.
func cardOf(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	accountID, cardID uuid.UUID,
) (domain.Card, error) {
	cards, err := svc.Cards(ctx, booksID, accountID)
	if err != nil {
		return domain.Card{}, err
	}

	for _, c := range cards {
		if c.ID == cardID {
			return c, nil
		}
	}

	return domain.Card{}, app.ErrNotFound
}

func optionalBP(o tool.OptionalInt) *int {
	if !o.Set {
		return nil
	}

	return &o.N
}

// cycleChanges lists what a set_billing_cycle call sets. The options the call left out take the
// defaults of the domain, so only the ones it gave are listed.
func cycleChanges(in manageCardIn, rule domain.BillingCycleRule) []tool.Change {
	closing := strconv.Itoa(in.ClosingDay)
	if in.ClosingMode == "before_due" {
		closing = fmt.Sprintf("%d days before the due date", in.ClosingDaysBeforeDue)
	}

	changes := []tool.Change{
		{Field: "closing_day", After: tool.TextValue(closing)},
		{Field: "due_day", After: tool.TextValue(strconv.Itoa(in.DueDay))},
		{Field: "date", After: tool.DateValue(rule.EffectiveFrom.FirstDay())},
	}

	var options []string

	for _, o := range []struct{ name, value string }{
		{"closing adjustment", rule.ClosingAdjustment}, {"closing day assignment", rule.Assignment},
		{"due date adjustment", rule.Adjustment}, {"calendar", rule.Calendar},
	} {
		if o.value != "" {
			options = append(options, o.name+" "+o.value)
		}
	}

	if len(options) > 0 {
		changes = append(
			changes,
			tool.Change{Field: "terms", After: tool.TextValue(strings.Join(options, ", "))},
		)
	}

	return changes
}
