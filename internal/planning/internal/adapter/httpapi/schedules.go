package httpapi

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
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
		Frequency: domain.Frequency(r.Frequency), Interval: r.Interval, DayOfMonth: intOf(r.DayOfMonth),
		Ordinal: intOf(r.Ordinal), BusinessDayOrdinal: intOf(r.BusinessDayOrdinal),
		Start: r.Start.Time, Until: optDate(r.Until), Count: intOf(r.Count),
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
		Frequency: RecurrenceFrequency(rule.Frequency), Interval: rule.Interval, DayOfMonth: optInt(rule.DayOfMonth),
		Ordinal: optInt(rule.Ordinal), BusinessDayOrdinal: optInt(rule.BusinessDayOrdinal), Adjustment: &adjustment,
		Start: apiDate(rule.Start), Until: apiOptDate(rule.Until), Count: optInt(rule.Count),
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

func toScheduleAPI(s domain.Schedule) Schedule {
	out := Schedule{
		Id: s.ID, Kind: ScheduleKind(s.Kind), AccountId: s.AccountID, CounterpartId: s.CounterpartID,
		PayeeId: apiOptUUID(s.PayeeID), Description: s.Description, MatchToleranceBp: s.ToleranceBP,
		GraceDays: s.GraceDays, Calendar: s.Calendar, EndsOn: apiOptDate(s.EndsOn),
		Terms: make([]ScheduleTerms, len(s.Terms)), Pauses: make([]SchedulePause, len(s.Pauses)),
	}
	for i, t := range s.Terms {
		out.Terms[i] = ScheduleTerms{EffectiveFrom: apiDate(t.EffectiveFrom), Amount: toMoneyAPI(t.Amount, s.Currency), Recurrence: toRecurrenceAPI(t.Rule)}
	}
	for i, p := range s.Pauses {
		out.Pauses[i] = SchedulePause{From: apiDate(p.From), To: apiDate(p.To)}
	}
	return out
}

func (s *Server) CreateSchedule(ctx context.Context, req CreateScheduleRequestObject) (CreateScheduleResponseObject, error) {
	b := req.Body
	amount, err := fromMoneyAPI("amount", b.Amount)
	if err != nil {
		return nil, err
	}
	created, err := s.svc.CreateSchedule(ctx, auth.MustUserID(ctx), app.ScheduleInput{
		Kind: domain.Kind(b.Kind), AccountID: b.AccountId, CounterpartID: b.CounterpartId, PayeeID: optUUID(b.PayeeId),
		Description: b.Description, Amount: amount, Rule: fromRecurrenceAPI(b.Recurrence), Calendar: stringOf(b.Calendar),
		ToleranceBP: b.MatchToleranceBp, GraceDays: b.GraceDays,
	})
	if err != nil {
		return nil, err
	}
	return CreateSchedule201JSONResponse{Body: toScheduleAPI(created), Headers: CreateSchedule201ResponseHeaders{Location: location("/schedules/", created.ID)}}, nil
}

func (s *Server) GetSchedule(ctx context.Context, req GetScheduleRequestObject) (GetScheduleResponseObject, error) {
	sch, err := s.svc.Schedule(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	return GetSchedule200JSONResponse(toScheduleAPI(sch)), nil
}

func (s *Server) ListSchedules(ctx context.Context, req ListSchedulesRequestObject) (ListSchedulesResponseObject, error) {
	p, err := listPage[app.IDKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	ss, next, err := s.svc.ListSchedules(ctx, auth.MustUserID(ctx), p)
	if err != nil {
		return nil, err
	}
	out := ListSchedules200JSONResponse{Items: make([]Schedule, len(ss))}
	for i, sch := range ss {
		out.Items[i] = toScheduleAPI(sch)
	}
	out.NextCursor, err = page.Next(next)
	return out, err
}

func toOccurrenceAPI(o app.OccurrenceView) Occurrence {
	return Occurrence{
		Id: o.ID, ScheduleId: o.ScheduleID, Sequence: o.Sequence, ExpectedOn: apiDate(o.ExpectedOn),
		ExpectedAmount: toMoneyAPI(o.Amount, o.Currency), State: OccurrenceState(o.Shown),
		TransactionId: apiOptUUID(o.TransactionID), MovedFrom: apiOptDate(o.MovedFrom),
	}
}

func (s *Server) ListOccurrences(ctx context.Context, req ListOccurrencesRequestObject) (ListOccurrencesResponseObject, error) {
	var state domain.State
	if req.Params.State != nil {
		state = domain.State(*req.Params.State)
	}
	os, err := s.svc.Occurrences(ctx, auth.MustUserID(ctx), req.Params.From.Time, req.Params.To.Time, optUUID(req.Params.ScheduleId), state)
	if err != nil {
		return nil, err
	}
	out := ListOccurrences200JSONResponse{Items: make([]Occurrence, len(os))}
	for i, o := range os {
		out.Items[i] = toOccurrenceAPI(o)
	}
	return out, nil
}

func stringOf(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
