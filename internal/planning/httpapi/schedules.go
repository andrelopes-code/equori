package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

var weekdays = map[RecurrenceWeekday]time.Weekday{
	Sunday: time.Sunday, Monday: time.Monday, Tuesday: time.Tuesday, Wednesday: time.Wednesday,
	Thursday: time.Thursday, Friday: time.Friday, Saturday: time.Saturday,
}

func intOf(p *int) int {
	if p == nil {
		return 0
	}

	return *p
}

func optInt(v int) *int {
	if v == 0 {
		return nil
	}

	return &v
}

func fromRecurrenceAPI(r Recurrence) domain.Rule {
	rule := domain.Rule{
		Frequency: domain.Frequency(
			r.Frequency,
		),
		Interval:           r.Interval,
		DayOfMonth:         intOf(r.DayOfMonth),
		Ordinal:            intOf(r.Ordinal),
		BusinessDayOrdinal: intOf(r.BusinessDayOrdinal),
		Start:              r.Start.Time,
		Until:              optDate(r.Until),
		Count:              intOf(r.Count),
	}
	if r.Adjustment != nil {
		rule.Adjustment = string(*r.Adjustment)
	}

	if r.Weekday != nil {
		w := weekdays[*r.Weekday]
		rule.Weekday = &w
	}

	return rule
}

func toRecurrenceAPI(rule domain.Rule) Recurrence {
	adjustment := RecurrenceAdjustment(rule.Adjustment)

	out := Recurrence{
		Frequency: RecurrenceFrequency(
			rule.Frequency,
		),
		Interval:   rule.Interval,
		DayOfMonth: optInt(rule.DayOfMonth),
		Ordinal: optInt(
			rule.Ordinal,
		),
		BusinessDayOrdinal: optInt(rule.BusinessDayOrdinal),
		Adjustment:         &adjustment,
		Start:              apiDate(rule.Start),
		Until:              apiOptDate(rule.Until),
		Count:              optInt(rule.Count),
	}
	if rule.Weekday != nil {
		for name, w := range weekdays {
			if w == *rule.Weekday {
				out.Weekday = &name
			}
		}
	}

	return out
}

// scheduleAPI returns the schedule with the sets it moves money between (A253).
func (s *Server) scheduleAPI(ctx context.Context, sch domain.Schedule) (Schedule, error) {
	moves, err := s.svc.ScheduleMoves(ctx, auth.MustBooksID(ctx), []domain.Schedule{sch})
	if err != nil {
		return Schedule{}, err
	}

	return toScheduleAPI(sch, moves), nil
}

func toScheduleAPI(s domain.Schedule, moves map[uuid.UUID]app.Moves) Schedule {
	out := Schedule{
		Id:               s.ID,
		Kind:             ScheduleKind(s.Kind),
		AccountId:        s.AccountID,
		CounterpartId:    s.CounterpartID,
		PayeeId:          apiOptUUID(s.PayeeID),
		GoalId:           apiOptUUID(s.GoalID),
		Description:      s.Description,
		MatchToleranceBp: s.ToleranceBP,
		GraceDays:        s.GraceDays,
		MatchWindowDays:  s.WindowDays,
		Calendar:         s.Calendar,
		EndsOn:           apiOptDate(s.EndsOn),
		Terms:            make([]ScheduleTerms, len(s.Terms)),
		Pauses:           make([]SchedulePause, len(s.Pauses)),
	}
	for i, t := range s.Terms {
		out.Terms[i] = ScheduleTerms{
			EffectiveFrom: apiDate(t.EffectiveFrom),
			Amount:        toMoneyAPI(t.Amount, s.Currency),
			Recurrence:    toRecurrenceAPI(t.Rule),
		}
	}

	for i, p := range s.Pauses {
		out.Pauses[i] = SchedulePause{From: apiDate(p.From), To: apiDate(p.To)}
	}

	if m, ok := moves[s.ID]; ok {
		out.Moves = &ScheduleMoves{From: AccountSet(m.From), To: AccountSet(m.To)}
	}

	return out
}

func (s *Server) createSchedule(
	ctx context.Context, _ *http.Request, in CreateScheduleJSONRequestBody,
) (Schedule, string, error) {
	created, err := s.addSchedule(ctx, in)
	if err != nil {
		return Schedule{}, "", err
	}

	out, err := s.scheduleAPI(ctx, created)

	return out, BaseURL + "/schedules/" + created.ID.String(), err
}

func (s *Server) getSchedule(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (Schedule, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Schedule{}, err
	}

	sch, err := s.svc.Schedule(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return Schedule{}, err
	}

	return s.scheduleAPI(ctx, sch)
}

func (s *Server) listSchedules(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (SchedulePage, error) {
	params, err := httpserver.Query[ListSchedulesParams](r)
	if err != nil {
		return SchedulePage{}, err
	}

	p, err := listPage[app.IDKey](params.Limit, params.Cursor)
	if err != nil {
		return SchedulePage{}, err
	}

	ss, next, err := s.svc.ListSchedules(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return SchedulePage{}, err
	}

	moves, err := s.svc.ScheduleMoves(ctx, auth.MustBooksID(ctx), ss)
	if err != nil {
		return SchedulePage{}, err
	}

	out := SchedulePage{Items: make([]Schedule, len(ss))}
	for i, sch := range ss {
		out.Items[i] = toScheduleAPI(sch, moves)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func toOccurrenceAPI(o app.OccurrenceView) Occurrence {
	out := Occurrence{
		Id: o.ID, ScheduleId: o.ScheduleID, Sequence: o.Sequence, ExpectedOn: apiDate(o.ExpectedOn),
		ExpectedAmount: toMoneyAPI(o.Amount, o.Currency), State: OccurrenceState(o.Shown),
		TransactionId: apiOptUUID(o.TransactionID), MovedFrom: apiOptDate(o.MovedFrom),
	}
	if o.Actual != nil {
		actual := toMoneyAPI(*o.Actual, o.Currency)
		out.ActualAmount = &actual
	}

	return out
}

func (s *Server) listOccurrences(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (OccurrenceList, error) {
	params, err := httpserver.Query[ListOccurrencesParams](r)
	if err != nil {
		return OccurrenceList{}, err
	}

	var state domain.State
	if params.State != nil {
		state = domain.State(*params.State)
	}

	var os []app.OccurrenceView

	switch {
	case params.TransactionId != nil:
		os, err = s.svc.OccurrencesOfTransaction(ctx, auth.MustBooksID(ctx), *params.TransactionId)
	case params.From == nil:
		err = &paramError{field: "from", message: "value is required but missing"}
	case params.To == nil:
		err = &paramError{field: "to", message: "value is required but missing"}
	default:
		os, err = s.svc.Occurrences(
			ctx,
			auth.MustBooksID(ctx),
			params.From.Time,
			params.To.Time,
			optUUID(params.ScheduleId),
			state,
		)
	}

	if err != nil {
		return OccurrenceList{}, err
	}

	out := OccurrenceList{Items: make([]Occurrence, len(os))}
	for i, o := range os {
		out.Items[i] = toOccurrenceAPI(o)
	}

	return out, nil
}

func (s *Server) addSchedule(
	ctx context.Context,
	b CreateScheduleJSONRequestBody,
) (domain.Schedule, error) {
	amount, err := fromMoneyAPI("amount", b.Amount)
	if err != nil {
		return domain.Schedule{}, err
	}

	return s.svc.CreateSchedule(ctx, auth.MustBooksID(ctx), app.ScheduleInput{
		Kind: domain.Kind(
			b.Kind,
		),
		AccountID:     b.AccountId,
		CounterpartID: b.CounterpartId,
		PayeeID:       optUUID(b.PayeeId),
		GoalID:        optUUID(b.GoalId),
		Description:   b.Description,
		Amount:        amount,
		Rule:          fromRecurrenceAPI(b.Recurrence),
		Calendar:      stringOf(b.Calendar),
		ToleranceBP:   b.MatchToleranceBp,
		GraceDays:     b.GraceDays,
		WindowDays:    b.MatchWindowDays,
	})
}
func stringOf(p *string) string {
	if p == nil {
		return ""
	}

	return *p
}
