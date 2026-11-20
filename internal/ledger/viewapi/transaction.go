package viewapi

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

type transactionPosting struct {
	Account string     `json:"account"`
	Class   string     `json:"class"`
	Amount  view.Money `json:"amount"`
}

type transactionChange struct {
	Version int    `json:"version"`
	Reason  string `json:"reason,omitempty"`
	At      string `json:"at"`
}

type transactionData struct {
	Item        txItem               `json:"item"`
	Tags        []string             `json:"tags"`
	Postings    []transactionPosting `json:"postings"`
	History     []transactionChange  `json:"history"`
	Attachments []attachmentView     `json:"attachments"`
}

// transactionFormView draws one transaction whole: its amount first, its double-entry postings,
// the versions it went through and its attachments.
func transactionFormView(
	outputs []json.RawMessage,
	_ view.Select,
	_ time.Time,
) (view.Payload, error) {
	var out getTransactionOut
	if err := json.Unmarshal(outputs[0], &out); err != nil {
		return view.Payload{}, fmt.Errorf("decode get_transaction output: %w", err)
	}

	item, err := txItemOf(out.Transaction)
	if err != nil {
		return view.Payload{}, err
	}

	data := transactionData{
		Item:        item,
		Tags:        append([]string{}, out.Transaction.Tags...),
		History:     []transactionChange{},
		Attachments: append([]attachmentView{}, out.Attachments...),
	}

	data.Postings, err = transactionPostings(out.Transaction.Postings)
	if err != nil {
		return view.Payload{}, err
	}

	for _, h := range out.History {
		data.History = append(
			data.History,
			transactionChange{Version: h.Version, Reason: h.Reason, At: h.ReplacedAt},
		)
	}

	return view.Payload{
		Title:   view.Text{Key: "assistantView.transaction.title"},
		Window:  view.Window{At: item.Date},
		Verdict: transactionVerdict(data),
		Open:    &view.Link{Screen: "/transactions/" + item.ID},
		Rows:    transactionRows(data.Postings),
		Data:    data,
	}, nil
}

func transactionPostings(postings []postingView) ([]transactionPosting, error) {
	out := []transactionPosting{}
	for _, p := range postings {
		m, err := view.Amount(p.Amount.Amount, p.Amount.Currency)
		if err != nil {
			return nil, err
		}

		out = append(
			out,
			transactionPosting{Account: p.AccountName, Class: p.AccountClass, Amount: m},
		)
	}

	return out, nil
}

func transactionRows(postings []transactionPosting) view.Table {
	t := view.Table{
		Head: []string{"assistantView.col.account", "assistantView.col.amount"},
		Rows: [][]view.Value{},
	}
	for _, p := range postings {
		t.Rows = append(t.Rows, []view.Value{view.TextValue(p.Account), view.MoneyValue(p.Amount)})
	}

	return t
}

func transactionVerdict(d transactionData) view.Text {
	params := map[string]view.Value{
		"name":    view.TextValue(d.Item.Name),
		"amount":  view.MoneyValue(d.Item.Amount),
		"account": view.TextValue(d.Item.Account),
	}

	switch {
	case len(d.History) > 0:
		params["count"] = view.CountValue(int64(len(d.History)))
		return view.Text{Key: "assistantView.transaction.verdict_changed", Params: params}
	case len(d.Attachments) > 0:
		return view.Text{Key: "assistantView.transaction.verdict_attached", Params: params}
	default:
		return view.Text{Key: "assistantView.transaction.verdict", Params: params}
	}
}
