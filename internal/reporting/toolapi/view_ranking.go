package toolapi

import (
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

// Rows a ranking shows before the rest folds into one row (answer views design, ranking).
const rankingLimit = 5

var errPaged = errors.New("the read has more categories than one page; read them all before a view")

type rankingItem struct {
	AccountID string     `json:"account_id"`
	Name      string     `json:"name"`
	Amount    view.Money `json:"amount"`
	ShareBP   int64      `json:"share_bp"`
	Rank      int        `json:"rank"`
}

type rankingRest struct {
	Count   int        `json:"count"`
	Amount  view.Money `json:"amount"`
	ShareBP int64      `json:"share_bp"`
}

type rankingData struct {
	Total view.Money    `json:"total"`
	Items []rankingItem `json:"items"`
	Rest  *rankingRest  `json:"rest,omitempty"`
}

// Views returns the builders of the reporting reads (answer views design, V3).
func Views() map[view.Key]view.Builder {
	return map[view.Key]view.Builder{
		{Tool: "get_category_totals", Form: "ranking"}: rankingView,
		{Tool: "get_category_totals", Form: "compare"}: compareView,
	}
}

func rankingView(outputs []json.RawMessage, sel view.Select, _ time.Time) (view.Payload, error) {
	out, err := decodeTotals(outputs[0])
	if err != nil {
		return view.Payload{}, err
	}

	items, total, err := topLevel(out)
	if err != nil {
		return view.Payload{}, err
	}

	limit := cmp.Or(sel.Limit, rankingLimit)
	data := rankingData{Total: total, Items: []rankingItem{}}
	for i, it := range items {
		it.ShareBP = view.Share(it.Amount.Amount, total.Amount)
		if i < limit {
			it.Rank = i + 1
			data.Items = append(data.Items, it)

			continue
		}

		if data.Rest == nil {
			data.Rest = &rankingRest{Amount: view.Money{Currency: total.Currency}}
		}

		data.Rest.Count++
		data.Rest.Amount.Amount += it.Amount.Amount
	}

	if data.Rest != nil {
		data.Rest.ShareBP = view.Share(data.Rest.Amount.Amount, total.Amount)
	}

	return view.Payload{
		Title: view.Text{Key: "assistantView.ranking.title"},
		Window: view.Window{
			From: out.From.Format(time.DateOnly),
			To:   out.To.Format(time.DateOnly),
		},
		Verdict: rankingVerdict(data),
		Prov: &view.Text{
			Key:    "assistantView.prov.categories",
			Params: map[string]view.Value{"count": view.CountValue(int64(len(items)))},
		},
		Open: &view.Link{
			Screen: "reports",
			Params: map[string]string{
				"from": out.From.Format(time.DateOnly),
				"to":   out.To.Format(time.DateOnly),
			},
		},
		Rows: rankingRows(data),
		Data: data,
	}, nil
}

func rankingVerdict(d rankingData) view.Text {
	if d.Total.Amount == 0 || len(d.Items) == 0 {
		return view.Text{Key: "assistantView.ranking.empty"}
	}

	return view.Text{Key: "assistantView.ranking.verdict", Params: map[string]view.Value{
		"name":  view.TextValue(d.Items[0].Name),
		"share": view.BPValue(d.Items[0].ShareBP),
		"total": view.MoneyValue(d.Total),
	}}
}

func rankingRows(d rankingData) view.Table {
	t := view.Table{
		Head: []string{
			"assistantView.col.category",
			"assistantView.col.total",
			"assistantView.col.share",
		},
		Rows: [][]view.Value{},
	}
	for _, it := range d.Items {
		t.Rows = append(
			t.Rows,
			[]view.Value{
				view.TextValue(it.Name),
				view.MoneyValue(it.Amount),
				view.BPValue(it.ShareBP),
			},
		)
	}

	if d.Rest != nil {
		t.Rows = append(t.Rows, []view.Value{
			{Text: "assistantView.ranking.rest", Count: &[]int64{int64(d.Rest.Count)}[0]},
			view.MoneyValue(d.Rest.Amount),
			view.BPValue(d.Rest.ShareBP),
		})
	}

	return t
}

func decodeTotals(raw json.RawMessage) (getCategoryTotalsOut, error) {
	var out getCategoryTotalsOut
	if err := json.Unmarshal(raw, &out); err != nil {
		return out, fmt.Errorf("decode get_category_totals output: %w", err)
	}

	if out.NextCursor != "" {
		return out, errPaged
	}

	return out, nil
}

// topLevel returns the top-level categories by subtree total, largest first, ties by name, and their sum.
func topLevel(out getCategoryTotalsOut) ([]rankingItem, view.Money, error) {
	var total view.Money
	items := []rankingItem{}
	for _, c := range out.Categories {
		if c.ParentID != "" {
			continue
		}

		m, err := view.Amount(c.SubtreeTotal.Amount, c.SubtreeTotal.Currency)
		if err != nil {
			return nil, total, err
		}

		if total.Currency == "" {
			total.Currency = m.Currency
		}

		if m.Currency != total.Currency {
			return nil, total, view.ErrCurrencies
		}

		total.Amount += m.Amount
		items = append(items, rankingItem{AccountID: c.AccountID, Name: c.Name, Amount: m})
	}

	slices.SortStableFunc(items, func(a, b rankingItem) int {
		return cmp.Or(cmp.Compare(b.Amount.Amount, a.Amount.Amount), cmp.Compare(a.Name, b.Name))
	})

	return items, total, nil
}
