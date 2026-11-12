package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func prepareSchedule(
	ctx context.Context,
	svc *app.Service,
	l Ledger,
	booksID int64,
	in manageScheduleIn,
) (schedulePlan, error) {
	if err := checkScheduleFields(in); err != nil {
		return schedulePlan{}, err
	}

	p, err := decodeScheduleArguments(ctx, svc, booksID, in)
	if err != nil {
		return schedulePlan{}, err
	}

	unit := money.Money{}
	switch in.Action {
	case "create":
		if unit, err = prepareScheduleCreate(ctx, l, booksID, in, &p); err != nil {
			return schedulePlan{}, err
		}
	case "change_terms":
		if unit, err = prepareTermsChange(in, &p); err != nil {
			return schedulePlan{}, err
		}
	case "pause":
		if err = checkPause(in, p); err != nil {
			return schedulePlan{}, err
		}
	}

	if err = finishSchedulePlan(in, &p, unit); err != nil {
		return schedulePlan{}, err
	}

	return p, nil
}

func checkScheduleFields(in manageScheduleIn) error {
	given := func(s string) bool { return s != "" }
	fields := []field{
		{
			"schedule_id",
			given(in.ScheduleID),
		},
		{"kind", given(string(in.Kind))},
		{"description", given(in.Description)},
		{
			"account_id",
			given(in.AccountID),
		},
		{"counterpart_id", given(in.CounterpartID)},
		{"payee_id", given(in.PayeeID)},
		{
			"amount",
			given(in.Amount),
		},
		{"frequency", given(string(in.Frequency))},
		{"interval", in.Interval != 0},
		{
			"day_of_month",
			in.DayOfMonth != 0,
		},
		{"start", !in.Start.IsZero()},
		{"until", !in.Until.IsZero()},
		{
			"from",
			!in.From.IsZero(),
		},
		{"to", !in.To.IsZero()},
		{"paid_by_transaction_id", given(in.PaidByTransactionID)},
		{"starts_on", !in.StartsOn.IsZero()},
		{"match_tolerance_bp", in.MatchToleranceBP.Set},
		{"grace_days", in.GraceDays.Set},
		{"match_window_days", in.MatchWindowDays.Set},
	}
	name := string(in.Action)

	var err error
	switch in.Action {
	case "create":
		err = required(
			name,
			fields,
			[]string{
				"kind",
				"description",
				"account_id",
				"counterpart_id",
				"amount",
				"frequency",
				"start",
			},
			"payee_id",
			"interval",
			"day_of_month",
			"until",
			"paid_by_transaction_id",
			"match_tolerance_bp",
			"grace_days",
			"match_window_days",
		)
	case "update":
		err = required(name, fields, []string{"schedule_id"},
			"description", "starts_on", "match_tolerance_bp", "grace_days", "match_window_days")
		if err == nil && !hasUpdateField(in) {
			err = tool.InvalidArgument(
				"description",
				"one of description, starts_on, match_tolerance_bp, grace_days or match_window_days is required for update",
			)
		}
	case "change_terms":
		err = required(
			name,
			fields,
			[]string{"schedule_id", "from"},
			"amount",
			"frequency",
			"interval",
			"day_of_month",
		)
		switch {
		case err != nil:
		case in.Amount == "" && in.Frequency == "":
			err = tool.InvalidArgument(
				"amount",
				"is required for change_terms unless frequency is given",
			)
		case in.Frequency == "" && in.Interval != 0:
			err = tool.InvalidArgument("interval", "requires frequency")
		case in.Frequency == "" && in.DayOfMonth != 0:
			err = tool.InvalidArgument("day_of_month", "requires frequency")
		}
	case "pause":
		err = required(name, fields, []string{"schedule_id", "from", "to"})
	case "end":
		err = required(name, fields, []string{"schedule_id", "from"})
	}

	return err
}

func decodeScheduleArguments(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageScheduleIn,
) (schedulePlan, error) {
	var (
		p          schedulePlan
		scheduleID uuid.UUID
		err        error
	)

	for _, id := range []struct {
		s, field string
		into     *uuid.UUID
	}{
		{in.ScheduleID, "schedule_id", &scheduleID}, {in.AccountID, "account_id", &p.accountID},
		{in.CounterpartID, "counterpart_id", &p.counterID}, {in.PayeeID, "payee_id", &p.payeeID},
		{in.PaidByTransactionID, "paid_by_transaction_id", &p.paidBy},
	} {
		if *id.into, err = optionalID(id.s, id.field); err != nil {
			return schedulePlan{}, err
		}
	}

	if scheduleID != uuid.Nil {
		if p.schedule, err = svc.Schedule(ctx, booksID, scheduleID); err != nil {
			return schedulePlan{}, err
		}
	}

	return p, nil
}

func prepareScheduleCreate(
	ctx context.Context,
	l Ledger,
	booksID int64,
	in manageScheduleIn,
	p *schedulePlan,
) (money.Money, error) {
	accounts, err := l.Accounts(ctx, booksID)
	if err != nil {
		return money.Money{}, err
	}

	var ok bool
	if p.account, ok = accounts[p.accountID]; !ok {
		return money.Money{}, validationError("account_id", "must be a balance account of the book")
	}

	if p.counterpart, ok = accounts[p.counterID]; !ok {
		return money.Money{}, validationError(
			"counterpart_id",
			"does not fit kind "+string(in.Kind),
		)
	}

	unit, err := unitOf(p.account.Instrument)
	if err != nil {
		return money.Money{}, err
	}

	rule := domain.Rule{
		Frequency: domain.Frequency(
			in.Frequency,
		),
		Interval:   max(in.Interval, 1),
		DayOfMonth: in.DayOfMonth,
		Adjustment: "none",
		Start:      in.Start.Time,
	}
	if !in.Until.IsZero() {
		rule.Until = &in.Until.Time
	}

	p.rule = &rule

	if p.paidBy != uuid.Nil {
		if err := checkPaidBy(ctx, l, booksID, p); err != nil {
			return money.Money{}, err
		}
	}

	return unit, nil
}

func prepareTermsChange(in manageScheduleIn, p *schedulePlan) (money.Money, error) {
	unit, err := unitOf(p.schedule.Currency)
	if err != nil {
		return money.Money{}, err
	}

	if in.Frequency != "" {
		last := p.schedule.Terms[len(p.schedule.Terms)-1].Rule
		p.rule = &domain.Rule{
			Frequency: domain.Frequency(
				in.Frequency,
			),
			Interval:   max(in.Interval, 1),
			DayOfMonth: in.DayOfMonth,
			Adjustment: last.Adjustment,
			Start:      last.Start,
			Until:      last.Until,
		}
	}

	return unit, nil
}

func checkPause(in manageScheduleIn, p schedulePlan) error {
	if in.To.Before(in.From.Time) {
		return validationError("to", "must not be before from")
	}

	for _, q := range p.schedule.Pauses {
		if !in.From.After(q.To) && !in.To.Before(q.From) {
			return app.ErrPauseOverlap
		}
	}

	return nil
}

func finishSchedulePlan(in manageScheduleIn, p *schedulePlan, unit money.Money) error {
	if (in.Action == "change_terms" || in.Action == "pause" || in.Action == "end") &&
		p.schedule.EndsOn != nil &&
		!in.From.Before(*p.schedule.EndsOn) {
		return app.ErrScheduleEnded
	}

	if p.rule != nil {
		if err := p.rule.Validate(); err != nil {
			return err
		}
	}

	if in.Amount != "" {
		m, err := tool.ParsePositive("amount", in.Amount, unit)
		if err != nil {
			return err
		}

		p.amount = &m
	}

	return nil
}

// checkPaidBy reads the paying transaction and requires an occurrence on the rule's start.
func checkPaidBy(ctx context.Context, l Ledger, booksID int64, p *schedulePlan) error {
	tx, ok, err := l.Transaction(ctx, booksID, p.paidBy)
	if err != nil {
		return err
	}

	if !ok {
		return tool.InvalidArgument("paid_by_transaction_id", "must name a transaction of the book")
	}

	if len(p.rule.Dates(p.rule.Start, p.rule.Start, nil)) == 0 {
		return tool.InvalidArgument(
			"paid_by_transaction_id",
			"the schedule has no occurrence on start",
		)
	}

	p.paidByFact = tx

	return nil
}
