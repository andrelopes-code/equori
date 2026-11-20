package toolapi

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

type projectionStep struct {
	Date        string     `json:"date"`
	Description string     `json:"description"`
	Amount      view.Money `json:"amount"`
	Balance     view.Money `json:"balance"`
}

type projectionData struct {
	Account string           `json:"account"`
	From    string           `json:"from"`
	To      string           `json:"to"`
	Opening view.Money       `json:"opening"`
	Points  []projectionStep `json:"points"`
	// The lowest balance of the period and its day; the opening day when nothing goes below it.
	Low projectionStep `json:"low"`
}

// projectionView draws an account's balance from today to a date, step by scheduled step, and
// marks the lowest point.
func projectionView(outputs []json.RawMessage, _ view.Select, _ time.Time) (view.Payload, error) {
	var out projectBalanceOut
	if err := json.Unmarshal(outputs[0], &out); err != nil {
		return view.Payload{}, fmt.Errorf("decode project_balance output: %w", err)
	}

	opening, err := view.Amount(out.Opening.Amount, out.Opening.Currency)
	if err != nil {
		return view.Payload{}, err
	}

	from := out.From.Format(time.DateOnly)
	data := projectionData{
		Account: out.AccountName,
		From:    from,
		To:      out.To.Format(time.DateOnly),
		Opening: opening,
		Points:  []projectionStep{},
		Low:     projectionStep{Date: from, Balance: opening},
	}

	for _, p := range out.Points {
		step, err := projectionStepOf(p)
		if err != nil {
			return view.Payload{}, err
		}

		data.Points = append(data.Points, step)
		if step.Balance.Amount < data.Low.Balance.Amount {
			data.Low = step
		}
	}

	return view.Payload{
		Title: view.Text{
			Key:    "assistantView.balance.title",
			Params: map[string]view.Value{"account": view.TextValue(out.AccountName)},
		},
		Window:  view.Window{From: data.From, To: data.To},
		Verdict: projectionVerdict(data.Low),
		Open:    &view.Link{Screen: "/planning", Params: map[string]string{"tab": "agenda"}},
		Rows:    projectionRows(data),
		Data:    data,
	}, nil
}

func projectionStepOf(p projectionPoint) (projectionStep, error) {
	amount, err := view.Amount(p.Amount.Amount, p.Amount.Currency)
	if err != nil {
		return projectionStep{}, err
	}

	balance, err := view.Amount(p.Balance.Amount, p.Balance.Currency)
	if err != nil {
		return projectionStep{}, err
	}

	return projectionStep{
		Date:        p.Date.Format(time.DateOnly),
		Description: p.Description,
		Amount:      amount,
		Balance:     balance,
	}, nil
}

func projectionVerdict(low projectionStep) view.Text {
	key := "assistantView.balance.verdict_positive"
	if low.Balance.Amount < 0 {
		key = "assistantView.balance.verdict_negative"
	}

	return view.Text{Key: key, Params: map[string]view.Value{
		"amount": view.MoneyValue(low.Balance),
		"day":    view.DateValue(low.Date),
	}}
}

func projectionRows(d projectionData) view.Table {
	t := view.Table{
		Head: []string{
			"assistantView.col.date",
			"assistantView.col.name",
			"assistantView.col.balance",
		},
		Rows: [][]view.Value{
			{
				view.DateValue(d.From),
				view.TextValue("assistantView.balance.today"),
				view.MoneyValue(d.Opening),
			},
		},
	}
	for _, p := range d.Points {
		t.Rows = append(
			t.Rows,
			[]view.Value{
				view.DateValue(p.Date),
				view.TextValue(p.Description),
				view.MoneyValue(p.Balance),
			},
		)
	}

	return t
}
