package toolapi

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type listSchedulesState string

func (listSchedulesState) Values() []string {
	return []string{"expected", "overdue", "realized", "skipped"}
}

type listSchedulesIn struct {
	ScheduleID string             `json:"schedule_id,omitzero" jsonschema:"one schedule, with its terms versions and pauses"`
	From       tool.Date          `json:"from,omitzero" jsonschema:"first date of the occurrences listed; today when absent"`
	To         tool.Date          `json:"to,omitzero" jsonschema:"last date of the occurrences listed; 31 days after from when absent; at most 366 days after from"`
	State      listSchedulesState `json:"state,omitzero" jsonschema:"keep occurrences in this state"`
	Month      string             `json:"month,omitzero" jsonschema:"return the installments and expected occurrences committed to this month; written YYYY-MM"`
	tool.PageArgs
}

type termsView struct {
	EffectiveFrom tool.Date  `json:"effective_from"`
	Amount        tool.Money `json:"amount"`
	Frequency     string     `json:"frequency"`
	Interval      int        `json:"interval"`
	DayOfMonth    int        `json:"day_of_month,omitzero"`
}

type pauseView struct {
	From tool.Date `json:"from"`
	To   tool.Date `json:"to"`
}

type scheduleView struct {
	ScheduleID      string      `json:"schedule_id"`
	Description     string      `json:"description"`
	Kind            string      `json:"kind"`
	AccountName     string      `json:"account_name"`
	CounterpartName string      `json:"counterpart_name"`
	Amount          tool.Money  `json:"amount"`
	Frequency       string      `json:"frequency"`
	NextExpectedOn  tool.Date   `json:"next_expected_on,omitzero"`
	Terms           []termsView `json:"terms,omitzero"`
	Pauses          []pauseView `json:"pauses,omitzero"`
}

type occurrenceView struct {
	OccurrenceID   string     `json:"occurrence_id"`
	ScheduleID     string     `json:"schedule_id"`
	Description    string     `json:"description"`
	ExpectedOn     tool.Date  `json:"expected_on"`
	ExpectedAmount tool.Money `json:"expected_amount"`
	State          string     `json:"state"`
	TransactionID  string     `json:"transaction_id,omitzero"`
}

type committedView struct {
	Month        string     `json:"month"`
	Installments tool.Money `json:"installments"`
	Occurrences  tool.Money `json:"occurrences"`
	Total        tool.Money `json:"total"`
}

type listSchedulesOut struct {
	Schedules   []scheduleView   `json:"schedules"`
	Occurrences []occurrenceView `json:"occurrences"`
	Committed   committedView    `json:"committed,omitzero"`
	NextCursor  string           `json:"next_cursor,omitzero" jsonschema:"present when more occurrences follow; pass it as cursor"`
}

// currentTerms is the terms version in force on date, or the first one before any applies.
func currentTerms(s domain.Schedule, date time.Time) domain.Terms {
	t := s.Terms[0]
	for _, c := range s.Terms {
		if !c.EffectiveFrom.After(date) {
			t = c
		}
	}
	return t
}

func toTermsView(s domain.Schedule, t domain.Terms) (termsView, error) {
	amount, err := moneyOf(t.Amount, s.Currency)
	return termsView{
		EffectiveFrom: tool.DateOf(t.EffectiveFrom), Amount: amount, Frequency: string(t.Rule.Frequency),
		Interval: t.Rule.Interval, DayOfMonth: t.Rule.DayOfMonth,
	}, err
}

// toScheduleView names the schedule's accounts; detail adds its terms versions and pauses.
func toScheduleView(s domain.Schedule, accounts map[uuid.UUID]Account, today time.Time, next map[uuid.UUID]time.Time, detail bool) (scheduleView, error) {
	t, err := toTermsView(s, currentTerms(s, today))
	if err != nil {
		return scheduleView{}, err
	}
	v := scheduleView{
		ScheduleID: s.ID.String(), Description: s.Description, Kind: string(s.Kind),
		AccountName: accountName(accounts, s.AccountID), CounterpartName: accountName(accounts, s.CounterpartID),
		Amount: t.Amount, Frequency: t.Frequency,
	}
	if d, ok := next[s.ID]; ok {
		v.NextExpectedOn = tool.DateOf(d)
	}
	if !detail {
		return v, nil
	}
	v.Terms, v.Pauses = []termsView{}, []pauseView{}
	for _, c := range s.Terms {
		tv, err := toTermsView(s, c)
		if err != nil {
			return scheduleView{}, err
		}
		v.Terms = append(v.Terms, tv)
	}
	for _, p := range s.Pauses {
		v.Pauses = append(v.Pauses, pauseView{From: tool.DateOf(p.From), To: tool.DateOf(p.To)})
	}
	return v, nil
}

// nextExpected returns the date of the first expected occurrence of each schedule from today on.
func nextExpected(ctx context.Context, svc *app.Service, userID int64, today time.Time) (map[uuid.UUID]time.Time, error) {
	os, err := svc.Occurrences(ctx, userID, today, today.AddDate(0, 0, 365), uuid.Nil, domain.Expected)
	if err != nil {
		return nil, err
	}
	next := map[uuid.UUID]time.Time{}
	for _, o := range os {
		if d, ok := next[o.ScheduleID]; !ok || o.ExpectedOn.Before(d) {
			next[o.ScheduleID] = o.ExpectedOn
		}
	}
	return next, nil
}

func listSchedules(svc *app.Service, l Ledger, clk clock.Clock) tool.Tool {
	return tool.New(tool.Spec{
		Name: "list_schedules",
		Description: "Lists recurring schedules (bills, income, subscriptions, transfers, savings) with their terms, the occurrences expected or realized in a period, or the total committed to a month. " +
			"Use it for upcoming bills, subscriptions and what is due. " +
			"Do not use it for budgets or goals: get_budgets_and_goals does.",
		Effect: tool.ReadOnly, Idempotent: true,
	}, func(ctx context.Context, userID int64, in listSchedulesIn) (listSchedulesOut, error) {
		scheduleID, err := optionalID(in.ScheduleID, "schedule_id")
		if err != nil {
			return listSchedulesOut{}, err
		}
		today := clk.Today()
		month, err := parseMonth("month", in.Month, time.Time{})
		if err != nil {
			return listSchedulesOut{}, err
		}
		from, to := today, today.AddDate(0, 0, 31)
		if !in.From.IsZero() {
			from = in.From.Time
			to = from.AddDate(0, 0, 31)
		}
		if !in.To.IsZero() {
			to = in.To.Time
		}
		if to.Before(from) || to.After(from.AddDate(0, 0, 366)) {
			return listSchedulesOut{}, tool.InvalidArgument("to", "must be between from and 366 days after from")
		}
		if _, err := tool.Limit(in.Limit); err != nil {
			return listSchedulesOut{}, err
		}
		accounts, err := l.Accounts(ctx, userID)
		if err != nil {
			return listSchedulesOut{}, err
		}
		var schedules []domain.Schedule
		if scheduleID != uuid.Nil {
			s, err := svc.Schedule(ctx, userID, scheduleID)
			if err != nil {
				return listSchedulesOut{}, err
			}
			schedules = []domain.Schedule{s}
		} else if schedules, err = allSchedules(ctx, svc, userID); err != nil {
			return listSchedulesOut{}, err
		}
		next, err := nextExpected(ctx, svc, userID, today)
		if err != nil {
			return listSchedulesOut{}, err
		}
		descriptions := make(map[uuid.UUID]string, len(schedules))
		out := listSchedulesOut{Schedules: []scheduleView{}, Occurrences: []occurrenceView{}}
		for _, s := range schedules {
			descriptions[s.ID] = s.Description
			v, err := toScheduleView(s, accounts, today, next, scheduleID != uuid.Nil)
			if err != nil {
				return listSchedulesOut{}, err
			}
			// The schedules come with the first page of occurrences only.
			if in.Cursor == "" {
				out.Schedules = append(out.Schedules, v)
			}
		}
		os, err := svc.Occurrences(ctx, userID, from, to, scheduleID, domain.State(in.State))
		if err != nil {
			return listSchedulesOut{}, err
		}
		page, nextCursor, err := tool.PageOf(os, func(o app.OccurrenceView) string { return o.ID.String() }, in.PageArgs)
		if err != nil {
			return listSchedulesOut{}, err
		}
		out.NextCursor = nextCursor
		for _, o := range page {
			amount, err := moneyOf(o.Amount, o.Currency)
			if err != nil {
				return listSchedulesOut{}, err
			}
			v := occurrenceView{
				OccurrenceID: o.ID.String(), ScheduleID: o.ScheduleID.String(), Description: descriptions[o.ScheduleID],
				ExpectedOn: tool.DateOf(o.ExpectedOn), ExpectedAmount: amount, State: string(o.Shown),
			}
			if o.TransactionID != uuid.Nil {
				v.TransactionID = o.TransactionID.String()
			}
			out.Occurrences = append(out.Occurrences, v)
		}
		if in.Month != "" {
			c, err := svc.Committed(ctx, userID, month)
			if err != nil {
				return listSchedulesOut{}, err
			}
			v := committedView{Month: month.Format(monthLayout)}
			for _, f := range []struct {
				amount int64
				into   *tool.Money
			}{{c.Installments, &v.Installments}, {c.Occurrences, &v.Occurrences}, {c.Total, &v.Total}} {
				if *f.into, err = moneyOf(f.amount, c.Currency); err != nil {
					return listSchedulesOut{}, err
				}
			}
			out.Committed = v
		}
		return out, nil
	})
}
