package planning_test

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func toolOutput(t testing.TB, h *apitest.Harness, name string, args map[string]any, out any) {
	t.Helper()
	r := h.Tool(name, args)
	if r.IsError {
		t.Fatalf("%s = error %s", name, r.Content)
	}
	if err := json.Unmarshal(r.Content, out); err != nil {
		t.Fatal(err)
	}
}

func preview(t testing.TB, h *apitest.Harness, name string, args map[string]any) (tool.Preview, tool.Result) {
	t.Helper()
	b, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}
	p, r, err := h.App.Tools.Preview(auth.WithUserID(t.Context(), h.OwnerID()), name, b)
	if err != nil {
		t.Fatalf("preview %s: %v", name, err)
	}
	return p, r
}

type toolMoney struct {
	Amount   string `json:"amount"`
	Currency string `json:"currency"`
}

type toolSchedule struct {
	ScheduleID      string    `json:"schedule_id"`
	Description     string    `json:"description"`
	Kind            string    `json:"kind"`
	AccountName     string    `json:"account_name"`
	CounterpartName string    `json:"counterpart_name"`
	Amount          toolMoney `json:"amount"`
	Frequency       string    `json:"frequency"`
	NextExpectedOn  string    `json:"next_expected_on"`
	Terms           []struct {
		EffectiveFrom string    `json:"effective_from"`
		Amount        toolMoney `json:"amount"`
		Frequency     string    `json:"frequency"`
	} `json:"terms"`
	Pauses []struct {
		From string `json:"from"`
		To   string `json:"to"`
	} `json:"pauses"`
}

type toolOccurrence struct {
	OccurrenceID   string    `json:"occurrence_id"`
	ScheduleID     string    `json:"schedule_id"`
	Description    string    `json:"description"`
	ExpectedOn     string    `json:"expected_on"`
	ExpectedAmount toolMoney `json:"expected_amount"`
	State          string    `json:"state"`
	TransactionID  string    `json:"transaction_id"`
}

type toolSchedules struct {
	Schedules   []toolSchedule   `json:"schedules"`
	Occurrences []toolOccurrence `json:"occurrences"`
	Committed   struct {
		Month        string    `json:"month"`
		Installments toolMoney `json:"installments"`
		Occurrences  toolMoney `json:"occurrences"`
		Total        toolMoney `json:"total"`
	} `json:"committed"`
}

func (f fixture) createRentByTool() string {
	f.h.T().Helper()
	var out toolSchedule
	toolOutput(f.h.T(), f.h, "manage_schedule", map[string]any{
		"action": "create", "kind": "bill", "description": "Rent", "account_id": f.checking, "counterpart_id": f.rent,
		"payee_id": f.landlord, "amount": "2100.00", "frequency": "monthly", "day_of_month": 5, "start": "2026-11-05",
	}, &out)
	return out.ScheduleID
}

// S27 through the assistant: the preview changes nothing; the call creates the schedule and its occurrences.
func TestManageScheduleCreate(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	args := map[string]any{
		"action": "create", "kind": "bill", "description": "Rent", "account_id": f.checking, "counterpart_id": f.rent,
		"payee_id": f.landlord, "amount": "2100.00", "frequency": "monthly", "day_of_month": 5, "start": "2026-11-05",
	}
	p, r := preview(t, f.h, "manage_schedule", args)
	if r.IsError {
		t.Fatalf("preview = error %s", r.Content)
	}
	want := tool.Preview{Action: "manage_schedule.create", Target: "Schedule Rent", Changes: []tool.Change{
		{Field: "schedule", After: tool.TextValue("Rent")},
		{Field: "amount", After: tool.Value{Amount: "2100.00", Currency: "BRL"}},
		{Field: "terms", After: tool.TextValue("monthly on day 5 from 2026-11-05")},
		{Field: "account", After: tool.TextValue("Nubank checking")},
		{Field: "category", After: tool.TextValue("Rent")},
		{Field: "date", After: tool.Value{Date: "2026-11-05"}},
	}}
	if !reflect.DeepEqual(p, want) {
		t.Errorf("preview = %+v, want %+v", p, want)
	}
	var none toolSchedules
	toolOutput(t, f.h, "list_schedules", map[string]any{}, &none)
	if len(none.Schedules) != 0 {
		t.Fatalf("schedules after the preview = %+v", none.Schedules)
	}

	f.createRentByTool()
	var got toolSchedules
	toolOutput(t, f.h, "list_schedules", map[string]any{"from": "2026-11-01", "to": "2027-01-31"}, &got)
	if len(got.Schedules) != 1 {
		t.Fatalf("schedules = %+v", got.Schedules)
	}
	s := got.Schedules[0]
	if s.Description != "Rent" || s.Kind != "bill" || s.AccountName != "Nubank checking" || s.CounterpartName != "Rent" ||
		s.Amount != (toolMoney{"2100.00", "BRL"}) || s.Frequency != "monthly" || s.NextExpectedOn != "2026-11-05" {
		t.Errorf("schedule = %+v", s)
	}
	var dates []string
	for _, o := range got.Occurrences {
		dates = append(dates, o.ExpectedOn)
		if o.ScheduleID != s.ScheduleID || o.Description != "Rent" || o.ExpectedAmount != (toolMoney{"2100.00", "BRL"}) || o.State != "expected" {
			t.Errorf("occurrence = %+v", o)
		}
	}
	if !reflect.DeepEqual(dates, []string{"2026-11-05", "2026-12-05", "2027-01-05"}) {
		t.Errorf("occurrence dates = %v", dates)
	}
}

// S29 through the assistant: a price change and a pause.
func TestManageScheduleChangeTermsAndPause(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	var created toolSchedule
	toolOutput(t, f.h, "manage_schedule", map[string]any{
		"action": "create", "kind": "subscription", "description": "Streaming", "account_id": f.checking, "counterpart_id": f.rent,
		"amount": "39.90", "frequency": "monthly", "day_of_month": 12, "start": "2026-11-12",
	}, &created)
	id := created.ScheduleID

	p, r := preview(t, f.h, "manage_schedule", map[string]any{"action": "change_terms", "schedule_id": id, "from": "2027-01-01", "amount": "44.90"})
	if r.IsError {
		t.Fatalf("preview = error %s", r.Content)
	}
	if p.Basis != "2026-11-12|3990" || p.Action != "manage_schedule.change_terms" || p.Target != "Schedule Streaming" {
		t.Errorf("preview = %+v", p)
	}
	toolOutput(t, f.h, "manage_schedule", map[string]any{"action": "change_terms", "schedule_id": id, "from": "2027-01-01", "amount": "44.90"}, &created)
	toolOutput(t, f.h, "manage_schedule", map[string]any{"action": "pause", "schedule_id": id, "from": "2027-02-01", "to": "2027-03-31"}, &created)

	var got toolSchedules
	toolOutput(t, f.h, "list_schedules", map[string]any{"schedule_id": id, "from": "2026-11-01", "to": "2027-05-31"}, &got)
	if len(got.Schedules) != 1 || len(got.Schedules[0].Terms) != 2 || got.Schedules[0].Terms[1].Amount != (toolMoney{"44.90", "BRL"}) ||
		len(got.Schedules[0].Pauses) != 1 || got.Schedules[0].Pauses[0].From != "2027-02-01" || got.Schedules[0].Pauses[0].To != "2027-03-31" {
		t.Fatalf("schedule = %+v", got.Schedules)
	}
	want := map[string]string{"2026-11-12": "39.90", "2026-12-12": "39.90", "2027-01-12": "44.90", "2027-04-12": "44.90", "2027-05-12": "44.90"}
	if len(got.Occurrences) != len(want) {
		t.Fatalf("occurrences = %+v", got.Occurrences)
	}
	for _, o := range got.Occurrences {
		if want[o.ExpectedOn] != o.ExpectedAmount.Amount {
			t.Errorf("occurrence %s = %s", o.ExpectedOn, o.ExpectedAmount.Amount)
		}
	}

	_, r = preview(t, f.h, "manage_schedule", map[string]any{"action": "pause", "schedule_id": id, "from": "2027-03-01", "to": "2027-03-10"})
	f.h.ExpectToolError(r, "pause_overlap", "")
	f.h.ExpectToolError(f.h.Tool("manage_schedule", map[string]any{"action": "pause", "schedule_id": id, "from": "2027-03-01", "to": "2027-03-10"}), "pause_overlap", "")
	toolOutput(t, f.h, "manage_schedule", map[string]any{"action": "end", "schedule_id": id, "from": "2027-05-01"}, &created)
	toolOutput(t, f.h, "list_schedules", map[string]any{"schedule_id": id, "from": "2027-04-01", "to": "2027-06-30"}, &got)
	if len(got.Occurrences) != 1 || got.Occurrences[0].ExpectedOn != "2027-04-12" {
		t.Errorf("occurrences after the end = %+v", got.Occurrences)
	}
}

func TestManageScheduleInvalidArguments(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	create := func(extra map[string]any) map[string]any {
		a := map[string]any{
			"action": "create", "kind": "bill", "description": "Rent", "account_id": f.checking, "counterpart_id": f.rent,
			"amount": "2100.00", "frequency": "monthly", "day_of_month": 5, "start": "2026-11-05",
		}
		for k, v := range extra {
			a[k] = v
		}
		return a
	}
	without := create(nil)
	delete(without, "start")
	tests := []struct {
		name  string
		args  map[string]any
		field string
	}{
		{"create without start", without, "start"},
		{"create with schedule_id", create(map[string]any{"schedule_id": f.rent}), "schedule_id"},
		{"create with to", create(map[string]any{"to": "2026-12-01"}), "to"},
		{"create with a bad account", create(map[string]any{"account_id": "x"}), "account_id"},
		{"create with a negative amount", create(map[string]any{"amount": "-1.00"}), "amount"},
		{"pause without to", map[string]any{"action": "pause", "schedule_id": f.rent, "from": "2026-12-01"}, "to"},
		{"end with amount", map[string]any{"action": "end", "schedule_id": f.rent, "from": "2026-12-01", "amount": "1.00"}, "amount"},
		{"change_terms without amount or frequency", map[string]any{"action": "change_terms", "schedule_id": f.rent, "from": "2026-12-01"}, "amount"},
	}
	for _, tt := range tests {
		f.h.ExpectToolError(f.h.Tool("manage_schedule", tt.args), "invalid_arguments", tt.field)
		_, r := preview(t, f.h, "manage_schedule", tt.args)
		f.h.ExpectToolError(r, "invalid_arguments", tt.field)
	}
	f.h.ExpectToolError(f.h.Tool("list_schedules", map[string]any{"schedule_id": "x"}), "invalid_arguments", "schedule_id")
	f.h.ExpectToolError(f.h.Tool("list_schedules", map[string]any{"month": "2026-13"}), "invalid_arguments", "month")
	f.h.ExpectToolError(f.h.Tool("list_schedules", map[string]any{"from": "2026-01-01", "to": "2027-06-01"}), "invalid_arguments", "to")
	f.h.ExpectToolError(f.h.Tool("manage_schedule", create(map[string]any{"counterpart_id": f.checking})), "validation_failed", "counterpart_id")
}

func TestScheduleToolsOtherUser(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	other := f.h.LoginAs("other@example.com", locale.Locale{Language: "pt", Region: "BR"}, "BRL")
	account := func(name, class string, kind string) string {
		var out struct {
			ID string `json:"id"`
		}
		body := map[string]any{"name": name, "class": class, "currency": "BRL"}
		if kind != "" {
			body["kind"] = kind
		}
		f.h.Call(other, http.MethodPost, "/api/v1/accounts", body).Decode(t, &out)
		return out.ID
	}
	checking, rent := account("Theirs", "asset", "checking"), account("Their rent", "expense", "")
	var s struct {
		ID string `json:"id"`
	}
	f.h.Call(other, http.MethodPost, "/api/v1/schedules", map[string]any{
		"kind": "bill", "account_id": checking, "counterpart_id": rent, "description": "bill",
		"amount": apitest.BRL(1000), "recurrence": monthly("2026-11-05", 5, ""),
	}).Decode(t, &s)
	occurrence := func() string {
		var o struct {
			Items []struct {
				ID string `json:"id"`
			} `json:"items"`
		}
		f.h.Call(other, http.MethodGet, "/api/v1/occurrences?from=2026-11-01&to=2026-11-30", nil).Decode(t, &o)
		return o.Items[0].ID
	}()

	f.h.ExpectToolError(f.h.Tool("list_schedules", map[string]any{"schedule_id": s.ID}), "not_found", "")
	f.h.ExpectToolError(f.h.Tool("manage_schedule", map[string]any{"action": "pause", "schedule_id": s.ID, "from": "2026-12-01", "to": "2026-12-31"}), "not_found", "")
	f.h.ExpectToolError(f.h.Tool("manage_schedule", map[string]any{"action": "end", "schedule_id": s.ID, "from": "2026-12-01"}), "not_found", "")
	f.h.ExpectToolError(f.h.Tool("manage_occurrence", map[string]any{"action": "skip", "occurrence_id": occurrence}), "not_found", "")
	f.h.ExpectToolError(f.h.Tool("project_balance", map[string]any{"account_id": checking, "to": "2026-12-31"}), "validation_failed", "")
	_, r := preview(t, f.h, "manage_occurrence", map[string]any{"action": "skip", "occurrence_id": occurrence})
	f.h.ExpectToolError(r, "not_found", "")
}

// S27 occurrence states through the assistant: realize, release, skip, move.
func TestManageOccurrence(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.createRentByTool()
	tx := f.pay("2026-11-07", 150000, f.rent, f.landlord)
	var list toolSchedules
	toolOutput(t, f.h, "list_schedules", map[string]any{"schedule_id": id, "from": "2026-11-01", "to": "2027-01-31"}, &list)
	first, second := list.Occurrences[0].OccurrenceID, list.Occurrences[1].OccurrenceID

	p, r := preview(t, f.h, "manage_occurrence", map[string]any{"action": "realize", "occurrence_id": first, "transaction_id": tx})
	if r.IsError {
		t.Fatalf("preview = error %s", r.Content)
	}
	want := tool.Preview{Action: "manage_occurrence.realize", Target: "Occurrence Rent expected 2026-11-05", Basis: "expected", Changes: []tool.Change{
		{Field: "occurrence", After: tool.TextValue("Rent expected 2026-11-05")},
		{Field: "status", Before: tool.TextValue("expected"), After: tool.TextValue("realized")},
		{Field: "transaction", After: tool.TextValue(tx)},
	}}
	if !reflect.DeepEqual(p, want) {
		t.Errorf("preview = %+v, want %+v", p, want)
	}
	toolOutput(t, f.h, "list_schedules", map[string]any{"schedule_id": id, "from": "2026-11-01", "to": "2027-01-31"}, &list)
	if list.Occurrences[0].State != "expected" {
		t.Fatalf("state after the preview = %s", list.Occurrences[0].State)
	}

	var out struct {
		State         string `json:"state"`
		TransactionID string `json:"transaction_id"`
	}
	toolOutput(t, f.h, "manage_occurrence", map[string]any{"action": "realize", "occurrence_id": first, "transaction_id": tx}, &out)
	if out.State != "realized" || out.TransactionID != tx {
		t.Errorf("realize = %+v", out)
	}
	f.h.ExpectToolError(f.h.Tool("manage_occurrence", map[string]any{"action": "skip", "occurrence_id": first}), "occurrence_closed", "")
	_, r = preview(t, f.h, "manage_occurrence", map[string]any{"action": "skip", "occurrence_id": first})
	f.h.ExpectToolError(r, "occurrence_closed", "")
	f.h.ExpectToolError(f.h.Tool("manage_occurrence", map[string]any{"action": "realize", "occurrence_id": second, "transaction_id": tx}), "transaction_in_use", "")
	toolOutput(t, f.h, "manage_occurrence", map[string]any{"action": "unrealize", "occurrence_id": first}, &out)
	if out.State != "expected" {
		t.Errorf("unrealize = %+v", out)
	}
	toolOutput(t, f.h, "manage_occurrence", map[string]any{"action": "skip", "occurrence_id": first, "reason": "paid in cash"}, &out)
	toolOutput(t, f.h, "manage_occurrence", map[string]any{"action": "move", "occurrence_id": second, "date": "2026-12-09"}, &out)
	toolOutput(t, f.h, "list_schedules", map[string]any{"schedule_id": id, "from": "2026-11-01", "to": "2027-01-31"}, &list)
	if list.Occurrences[0].State != "skipped" || list.Occurrences[1].ExpectedOn != "2026-12-09" {
		t.Errorf("occurrences = %+v", list.Occurrences)
	}
	toolOutput(t, f.h, "list_schedules", map[string]any{"schedule_id": id, "from": "2026-11-01", "to": "2027-01-31", "state": "skipped"}, &list)
	if len(list.Occurrences) != 1 {
		t.Errorf("skipped occurrences = %+v", list.Occurrences)
	}
}

func TestManageOccurrenceInvalidArguments(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	id := f.createRentByTool()
	var list toolSchedules
	toolOutput(t, f.h, "list_schedules", map[string]any{"schedule_id": id}, &list)
	o := list.Occurrences[0].OccurrenceID
	for _, tt := range []struct {
		args  map[string]any
		field string
	}{
		{map[string]any{"action": "realize", "occurrence_id": o}, "transaction_id"},
		{map[string]any{"action": "move", "occurrence_id": o}, "date"},
		{map[string]any{"action": "skip", "occurrence_id": o, "date": "2026-12-01"}, "date"},
		{map[string]any{"action": "unrealize", "occurrence_id": o, "reason": "x"}, "reason"},
		{map[string]any{"action": "skip", "occurrence_id": "x"}, "occurrence_id"},
	} {
		f.h.ExpectToolError(f.h.Tool("manage_occurrence", tt.args), "invalid_arguments", tt.field)
	}
}

// S62: the projection of a checking account with the rent of S27.
func TestProjectBalanceTool(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	f.h.Record("2026-10-31", apitest.Posting(f.checking, 500000), apitest.Posting(f.salary, -500000))
	f.createRentByTool()
	var got struct {
		AccountName string    `json:"account_name"`
		From        string    `json:"from"`
		To          string    `json:"to"`
		Opening     toolMoney `json:"opening"`
		Closing     toolMoney `json:"closing"`
		Points      []struct {
			Date        string    `json:"date"`
			Description string    `json:"description"`
			Amount      toolMoney `json:"amount"`
			Balance     toolMoney `json:"balance"`
		} `json:"points"`
	}
	toolOutput(t, f.h, "project_balance", map[string]any{"account_id": f.checking, "to": "2026-12-31"}, &got)
	if got.AccountName != "Nubank checking" || got.From != "2026-11-01" || got.To != "2026-12-31" ||
		got.Opening != (toolMoney{"5000.00", "BRL"}) || got.Closing != (toolMoney{"800.00", "BRL"}) || len(got.Points) != 2 {
		t.Fatalf("projection = %+v", got)
	}
	if p := got.Points[0]; p.Date != "2026-11-05" || p.Description != "Rent" || p.Amount != (toolMoney{"-2100.00", "BRL"}) || p.Balance != (toolMoney{"2900.00", "BRL"}) {
		t.Errorf("point = %+v", p)
	}
	f.h.ExpectToolError(f.h.Tool("project_balance", map[string]any{"account_id": f.checking, "to": "2026-10-01"}), "validation_failed", "")
	f.h.ExpectToolError(f.h.Tool("project_balance", map[string]any{"account_id": "x", "to": "2026-12-31"}), "invalid_arguments", "account_id")
}

// S63: the committed amount of a month.
func TestListSchedulesCommitted(t *testing.T) {
	t.Parallel()
	f := newFixture(t, "2026-11-01")
	f.createRentByTool()
	var got toolSchedules
	toolOutput(t, f.h, "list_schedules", map[string]any{"month": "2026-12"}, &got)
	if got.Committed.Month != "2026-12" || got.Committed.Occurrences != (toolMoney{"2100.00", "BRL"}) ||
		got.Committed.Installments != (toolMoney{"0.00", "BRL"}) || got.Committed.Total != (toolMoney{"2100.00", "BRL"}) {
		t.Errorf("committed = %+v", got.Committed)
	}
}
