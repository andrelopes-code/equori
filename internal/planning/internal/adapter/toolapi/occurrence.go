package toolapi

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/planning/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type manageOccurrenceAction string

func (manageOccurrenceAction) Values() []string {
	return []string{"realize", "skip", "move", "unrealize"}
}

type manageOccurrenceIn struct {
	OccurrenceID  string                 `json:"occurrence_id" jsonschema:"occurrence from list_schedules"`
	Action        manageOccurrenceAction `json:"action" jsonschema:"operation to propose"`
	TransactionID string                 `json:"transaction_id,omitzero" jsonschema:"for realize: the transaction that fulfilled the occurrence, from search_transactions"`
	Date          tool.Date              `json:"date,omitzero" jsonschema:"for move: new date"`
	Reason        string                 `json:"reason,omitzero" jsonschema:"for skip: why it is skipped"`
}

type manageOccurrenceOut struct {
	OccurrenceID  string    `json:"occurrence_id"`
	State         string    `json:"state"`
	ExpectedOn    tool.Date `json:"expected_on"`
	TransactionID string    `json:"transaction_id,omitzero"`
}

// occurrencePlan holds the parsed identifiers of a manage_occurrence call.
type occurrencePlan struct {
	occurrence, transaction uuid.UUID
}

func prepareOccurrence(in manageOccurrenceIn) (occurrencePlan, error) {
	fields := []field{{"transaction_id", in.TransactionID != ""}, {"date", !in.Date.IsZero()}, {"reason", in.Reason != ""}}
	var err error
	switch in.Action {
	case "realize":
		err = required(string(in.Action), fields, []string{"transaction_id"})
	case "skip":
		err = required(string(in.Action), fields, nil, "reason")
	case "move":
		err = required(string(in.Action), fields, []string{"date"})
	case "unrealize":
		err = required(string(in.Action), fields, nil)
	}
	if err != nil {
		return occurrencePlan{}, err
	}
	var p occurrencePlan
	if p.occurrence, err = optionalID(in.OccurrenceID, "occurrence_id"); err != nil {
		return occurrencePlan{}, err
	}
	p.transaction, err = optionalID(in.TransactionID, "transaction_id")
	return p, err
}

func manageOccurrence(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "manage_occurrence",
		Description: "Proposes an action on one occurrence of a schedule: link it to the transaction that paid it, skip it, move it to another date, or release a linked transaction. " +
			"Use it when the user says a bill was paid, will be skipped or moved. " +
			"Do not use it to change every future occurrence: manage_schedule does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, userID int64, in manageOccurrenceIn) (tool.Preview, error) {
		p, err := prepareOccurrence(in)
		if err != nil {
			return tool.Preview{}, err
		}
		o, err := svc.Occurrence(ctx, userID, p.occurrence)
		if err != nil {
			return tool.Preview{}, err
		}
		sch, err := svc.Schedule(ctx, userID, o.ScheduleID)
		if err != nil {
			return tool.Preview{}, err
		}
		wantState := domain.Expected
		if in.Action == "unrealize" {
			wantState = domain.Realized
		}
		if o.State != wantState {
			return tool.Preview{}, app.ErrOccurrenceClosed
		}
		name := sch.Description + " expected " + o.ExpectedOn.Format(time.DateOnly)
		pv := tool.Preview{Action: "manage_occurrence." + string(in.Action), Target: "Occurrence " + name, Basis: string(o.State)}
		pv.Changes = []tool.Change{{Field: "occurrence", After: tool.TextValue(name)}}
		status := func(after string) tool.Change {
			return tool.Change{Field: "status", Before: tool.TextValue(string(o.Shown)), After: tool.TextValue(after)}
		}
		switch in.Action {
		case "realize":
			pv.Changes = append(pv.Changes, status("realized"), tool.Change{Field: "transaction", After: tool.TextValue(in.TransactionID)})
		case "skip":
			pv.Changes = append(pv.Changes, status("skipped"))
			if in.Reason != "" {
				pv.Changes = append(pv.Changes, tool.Change{Field: "reason", After: tool.TextValue(in.Reason)})
			}
		case "move":
			if sch.EndsOn != nil && !in.Date.Before(*sch.EndsOn) {
				return tool.Preview{}, app.ErrScheduleEnded
			}
			if sch.Paused(in.Date.Time) {
				return tool.Preview{}, validationError("date", "falls inside a pause of the schedule")
			}
			pv.Changes = append(pv.Changes, tool.Change{Field: "date", Before: tool.DateValue(o.ExpectedOn), After: tool.DateValue(in.Date.Time)})
		case "unrealize":
			pv.Changes = append(pv.Changes, status("expected"), tool.Change{Field: "transaction", Before: tool.TextValue(o.TransactionID.String())})
		}
		return pv, nil
	}, func(ctx context.Context, userID int64, in manageOccurrenceIn) (manageOccurrenceOut, error) {
		p, err := prepareOccurrence(in)
		if err != nil {
			return manageOccurrenceOut{}, err
		}
		var o app.OccurrenceView
		switch in.Action {
		case "realize":
			o, err = svc.Realize(ctx, userID, p.occurrence, p.transaction)
		case "skip":
			o, err = svc.Skip(ctx, userID, p.occurrence, in.Reason)
		case "move":
			o, err = svc.Move(ctx, userID, p.occurrence, in.Date.Time)
		default:
			o, err = svc.Unrealize(ctx, userID, p.occurrence)
		}
		if err != nil {
			return manageOccurrenceOut{}, err
		}
		out := manageOccurrenceOut{OccurrenceID: o.ID.String(), State: string(o.Shown), ExpectedOn: tool.DateOf(o.ExpectedOn)}
		if o.TransactionID != uuid.Nil {
			out.TransactionID = o.TransactionID.String()
		}
		return out, nil
	})
}
