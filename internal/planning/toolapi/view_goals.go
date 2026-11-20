package toolapi

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

type goalItem struct {
	GoalID   string     `json:"goal_id"`
	Name     string     `json:"name"`
	Target   view.Money `json:"target"`
	Current  view.Money `json:"current"`
	Progress int64      `json:"progress_bp"`
	DueOn    string     `json:"due_on"`
	// Whole months from this month to the due month, and the amount each must put in.
	Months  int        `json:"months"`
	Monthly view.Money `json:"monthly"`
}

type goalsData struct {
	Goals []goalItem `json:"goals"`
}

// goalsView draws each goal's progress and what each month to its date must put in.
func goalsView(outputs []json.RawMessage, _ view.Select, today time.Time) (view.Payload, error) {
	var out getBudgetsAndGoalsOut
	if err := json.Unmarshal(outputs[0], &out); err != nil {
		return view.Payload{}, fmt.Errorf("decode get_budgets_and_goals output: %w", err)
	}

	data := goalsData{Goals: []goalItem{}}
	rows := view.Table{
		Head: []string{
			"assistantView.col.goal",
			"assistantView.col.saved",
			"assistantView.col.target",
		},
		Rows: [][]view.Value{},
	}

	for _, g := range out.Goals {
		it, err := goalItemOf(g, today)
		if err != nil {
			return view.Payload{}, err
		}

		data.Goals = append(data.Goals, it)
		rows.Rows = append(
			rows.Rows,
			[]view.Value{
				view.TextValue(it.Name),
				view.MoneyValue(it.Current),
				view.MoneyValue(it.Target),
			},
		)
	}

	return view.Payload{
		Title:   view.Text{Key: "assistantView.goals.title"},
		Window:  view.Window{At: today.Format(time.DateOnly)},
		Verdict: goalsVerdict(data.Goals),
		Open:    &view.Link{Screen: "/goals"},
		Rows:    rows,
		Data:    data,
	}, nil
}

// goalItemOf reads one goal; the monthly amount is the remaining amount over the months left,
// rounded up so the months reach the target.
func goalItemOf(g goalView, today time.Time) (goalItem, error) {
	vals := make([]view.Money, 3)
	for i, m := range []struct{ a, c string }{{g.Target.Amount, g.Target.Currency}, {g.Current.Amount, g.Current.Currency}, {g.Remaining.Amount, g.Remaining.Currency}} {
		v, err := view.Amount(m.a, m.c)
		if err != nil {
			return goalItem{}, err
		}

		vals[i] = v
	}

	months := (g.DueOn.Year()*12 + int(g.DueOn.Month())) - (today.Year()*12 + int(today.Month()))

	monthly := view.Money{Currency: vals[2].Currency}
	if months > 0 && vals[2].Amount > 0 {
		monthly.Amount = (vals[2].Amount + int64(months) - 1) / int64(months)
	}

	return goalItem{
		GoalID:   g.GoalID,
		Name:     g.Name,
		Target:   vals[0],
		Current:  vals[1],
		Progress: int64(g.ProgressBP),
		DueOn:    g.DueOn.Format(time.DateOnly),
		Months:   max(months, 0),
		Monthly:  monthly,
	}, nil
}

func goalsVerdict(goals []goalItem) view.Text {
	if len(goals) == 0 {
		return view.Text{Key: "assistantView.goals.empty"}
	}

	g := goals[0]
	if g.Months == 0 || g.Monthly.Amount == 0 {
		return view.Text{
			Key:    "assistantView.goals.verdict_due",
			Params: map[string]view.Value{"name": view.TextValue(g.Name)},
		}
	}

	return view.Text{Key: "assistantView.goals.verdict", Params: map[string]view.Value{
		"name":    view.TextValue(g.Name),
		"monthly": view.MoneyValue(g.Monthly),
		"months":  view.CountValue(int64(g.Months)),
		"due":     view.DateValue(g.DueOn),
	}}
}
