package viewapi

import (
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

// Rows a list of transactions shows before its screen link takes over.
const txsLimit = 8

var errOpenPage = errors.New("the search has more pages; read them all, up to 4, before a view")

type txItem struct {
	ID       string     `json:"id"`
	Date     string     `json:"date"`
	Name     string     `json:"name"`
	Account  string     `json:"account"`
	Category string     `json:"category"`
	Amount   view.Money `json:"amount"`
}

type txsData struct {
	Count   int        `json:"count"`
	Total   view.Money `json:"total"`
	Average view.Money `json:"average"`
	Items   []txItem   `json:"items"`
}

// Views returns the builders of the ledger reads (answer views design, V3).
func Views() map[view.Key]view.Builder {
	return map[view.Key]view.Builder{
		{Tool: "search_transactions", Form: "txs"}:      txsView,
		{Tool: "search_transactions", Form: "outliers"}: outliersView,
		{Tool: "search_transactions", Form: "heat"}:     heatView,
		{Tool: "get_transaction", Form: "transaction"}:  transactionFormView,
	}
}

// searchPages joins the pages of one search; the last page must close the list.
func searchPages(outputs []json.RawMessage) ([]transactionView, error) {
	var all []transactionView
	for i, raw := range outputs {
		var out searchTransactionsOut
		if err := json.Unmarshal(raw, &out); err != nil {
			return nil, fmt.Errorf("decode search_transactions output: %w", err)
		}

		if i == len(outputs)-1 && out.NextCursor != "" {
			return nil, errOpenPage
		}

		all = append(all, out.Transactions...)
	}

	return all, nil
}

// txItemOf reads a transaction as a row: its category postings negated (an expense reads
// negative), or its first posting when it has no category, as a transfer does.
func txItemOf(t transactionView) (txItem, error) {
	it := txItem{
		ID:   t.ID,
		Date: t.Date.Format(time.DateOnly),
		Name: cmp.Or(t.PayeeName, t.Description),
	}
	for _, p := range t.Postings {
		m, err := view.Amount(p.Amount.Amount, p.Amount.Currency)
		if err != nil {
			return txItem{}, err
		}

		switch p.AccountClass {
		case "income", "expense":
			it.Category = cmp.Or(it.Category, p.AccountName)
			it.Amount = view.Money{Amount: it.Amount.Amount - m.Amount, Currency: m.Currency}
		default:
			it.Account = cmp.Or(it.Account, p.AccountName)
		}
	}

	if it.Category == "" && len(t.Postings) > 0 {
		m, err := view.Amount(t.Postings[0].Amount.Amount, t.Postings[0].Amount.Currency)
		if err != nil {
			return txItem{}, err
		}

		it.Amount = m
	}

	return it, nil
}

func txsView(outputs []json.RawMessage, sel view.Select, _ time.Time) (view.Payload, error) {
	txs, err := searchPages(outputs)
	if err != nil {
		return view.Payload{}, err
	}

	data := txsData{Items: []txItem{}}
	for _, t := range txs {
		if t.Voided {
			continue
		}

		it, err := txItemOf(t)
		if err != nil {
			return view.Payload{}, err
		}

		if data.Total.Currency != "" && it.Amount.Currency != data.Total.Currency {
			return view.Payload{}, view.ErrCurrencies
		}

		data.Count++
		data.Total = view.Money{
			Amount:   data.Total.Amount + it.Amount.Amount,
			Currency: it.Amount.Currency,
		}

		if len(data.Items) < cmp.Or(sel.Limit, txsLimit) {
			data.Items = append(data.Items, it)
		}
	}

	if data.Count > 0 {
		data.Average = view.Money{
			Amount:   roundDiv(data.Total.Amount, int64(data.Count)),
			Currency: data.Total.Currency,
		}
	}

	return view.Payload{
		Title:   view.Text{Key: "assistantView.txs.title"},
		Window:  txsWindow(data.Items),
		Verdict: txsVerdict(data),
		Open:    &view.Link{Screen: "/transactions"},
		Rows:    txsRows(data.Items),
		Data:    data,
	}, nil
}

func txsVerdict(d txsData) view.Text {
	if d.Count == 0 {
		return view.Text{Key: "assistantView.txs.empty"}
	}

	return view.Text{Key: "assistantView.txs.verdict", Params: map[string]view.Value{
		"count":   view.CountValue(int64(d.Count)),
		"total":   view.MoneyValue(d.Total),
		"average": view.MoneyValue(d.Average),
	}}
}

// txsWindow spans the dates of the rows, newest first as the search returns them.
func txsWindow(items []txItem) view.Window {
	if len(items) == 0 {
		return view.Window{}
	}

	return view.Window{From: items[len(items)-1].Date, To: items[0].Date}
}

func txsRows(items []txItem) view.Table {
	t := view.Table{
		Head: []string{
			"assistantView.col.date",
			"assistantView.col.name",
			"assistantView.col.amount",
		},
		Rows: [][]view.Value{},
	}
	for _, it := range items {
		t.Rows = append(
			t.Rows,
			[]view.Value{
				view.DateValue(it.Date),
				view.TextValue(it.Name),
				view.MoneyValue(it.Amount),
			},
		)
	}

	return t
}

// roundDiv divides rounding half to even.
func roundDiv(a, n int64) int64 {
	q, r := a/n, a%n
	if r < 0 {
		r = -r
	}

	if 2*r > n || 2*r == n && q%2 != 0 {
		if a < 0 {
			return q - 1
		}

		return q + 1
	}

	return q
}
