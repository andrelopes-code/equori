package planning_test

import (
	"encoding/json"
	"testing"
)

// V19: the undo of create_budget deletes the budget it created.
func TestUndoCreateBudgetDeletesIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-12")
	food := f.h.Account("Food", "expense", "", nil)
	args := map[string]any{
		"action":      "create_budget",
		"category_id": food,
		"amount":      "700.00",
		"month":       "2026-11",
	}

	r := f.h.Tool("manage_budget_or_goal", args)
	if r.IsError {
		t.Fatalf("create = %s", r.Content)
	}

	b, _ := json.Marshal(args)

	u, ok := f.h.Undo("manage_budget_or_goal", string(b), string(r.Content))
	if !ok {
		t.Fatal("create_budget has no undo")
	}

	var in map[string]any
	if err := json.Unmarshal(u.Arguments, &in); err != nil {
		t.Fatal(err)
	}

	d := f.h.Tool(u.Tool, in)

	var out struct {
		Deleted bool `json:"deleted"`
	}
	if err := json.Unmarshal(d.Content, &out); d.IsError || err != nil || !out.Deleted {
		t.Fatalf("delete = %s", d.Content)
	}

	if again := f.h.Tool(u.Tool, in); !again.IsError {
		t.Fatalf("the budget still exists: %s", again.Content)
	}
}

// V19: the inverse each planning write derives from its call, or none.
func TestUndoPlanningWrites(t *testing.T) {
	t.Parallel()

	f := newFixture(t, "2026-11-12")

	tests := []struct {
		name, args, result string
		want               string
	}{
		{
			name:   "goal created",
			args:   `{"action":"create_goal","name":"Viagem","amount":"5000","due_on":"2027-06-01","account_ids":["a"]}`,
			result: `{"goal_id":"g1"}`,
			want:   `{"action":"delete_goal","goal_id":"g1"}`,
		},
		{
			name:   "expense linked",
			args:   `{"action":"link_expense","goal_id":"g1","transaction_id":"t1"}`,
			result: `{"goal_id":"g1"}`,
			want:   `{"action":"unlink_expense","goal_id":"g1","transaction_id":"t1"}`,
		},
		{
			name:   "expense unlinked",
			args:   `{"action":"unlink_expense","goal_id":"g1","transaction_id":"t1"}`,
			result: `{"goal_id":"g1"}`,
			want:   `{"action":"link_expense","goal_id":"g1","transaction_id":"t1"}`,
		},
		{
			name:   "allocation",
			args:   `{"action":"allocate","goal_id":"g1","account_ids":["a"],"amount":"250.00"}`,
			result: `{"goal_id":"g1"}`,
			want:   `{"action":"allocate","goal_id":"g1","amount":"-250.00","account_ids":["a"]}`,
		},
		{
			name:   "release",
			args:   `{"action":"allocate","goal_id":"g1","account_ids":["a"],"amount":"-250.00"}`,
			result: `{"goal_id":"g1"}`,
			want:   `{"action":"allocate","goal_id":"g1","amount":"250.00","account_ids":["a"]}`,
		},
		{
			name:   "amount changed",
			args:   `{"action":"set_budget_amount","budget_id":"b1","amount":"900","month":"2026-12"}`,
			result: `{"budget_id":"b1"}`,
		},
		{
			name:   "goal deleted",
			args:   `{"action":"delete_goal","goal_id":"g1"}`,
			result: `{"goal_id":"g1","deleted":true}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			u, ok := f.h.Undo("manage_budget_or_goal", tt.args, tt.result)

			if ok != (tt.want != "") || (ok && string(u.Arguments) != tt.want) {
				t.Fatalf("undo = %s %s, %v; want %s", u.Tool, u.Arguments, ok, tt.want)
			}
		})
	}

	occurrences := []struct{ action, want string }{
		{"realize", `{"occurrence_id":"o1","action":"unrealize"}`},
		{"skip", `{"occurrence_id":"o1","action":"reopen"}`},
		{"move", ""},
	}
	for _, o := range occurrences {
		args := `{"occurrence_id":"o1","action":"` + o.action + `","transaction_id":"t1"}`
		result := `{"occurrence_id":"o1","state":"realized","expected_on":"2026-11-10"}`

		u, ok := f.h.Undo("manage_occurrence", args, result)
		if ok != (o.want != "") || (ok && string(u.Arguments) != o.want) {
			t.Fatalf("%s: undo = %s %s, %v; want %s", o.action, u.Tool, u.Arguments, ok, o.want)
		}
	}
}
