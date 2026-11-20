package toolapi

import (
	"encoding/json"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

// The treemap keeps 7 categories (the categorical slots of the theme) and folds the rest.
const treemapSlots = 7

// The box the areas are squarified in: the proportion of the view's body, 400 × 176.
const (
	treeW = 400.0
	treeH = 176.0
)

type treemapCell struct {
	AccountID string     `json:"account_id,omitempty"`
	Name      string     `json:"name"`
	Amount    view.Money `json:"amount"`
	ShareBP   int64      `json:"share_bp"`
	Rest      bool       `json:"rest"`
	Count     int        `json:"count,omitempty"`
	// Position and size in percent of the box.
	X float64 `json:"x"`
	Y float64 `json:"y"`
	W float64 `json:"w"`
	H float64 `json:"h"`
}

type treemapData struct {
	Total view.Money    `json:"total"`
	Cells []treemapCell `json:"cells"`
}

// treemapView tiles a box with one area per category, its size the category's share.
func treemapView(outputs []json.RawMessage, _ view.Select, _ time.Time) (view.Payload, error) {
	out, err := decodeTotals(outputs[0])
	if err != nil {
		return view.Payload{}, err
	}

	items, total, err := topLevel(out)
	if err != nil {
		return view.Payload{}, err
	}

	fold := rankingFold(items, total, treemapSlots)
	cells := treemapCells(fold)
	squarify(cells, total.Amount)

	return view.Payload{
		Title: view.Text{Key: "assistantView.treemap.title"},
		Window: view.Window{
			From: out.From.Format(time.DateOnly),
			To:   out.To.Format(time.DateOnly),
		},
		Verdict: treemapVerdict(cells, total),
		Prov: &view.Text{
			Key:    "assistantView.prov.categories",
			Params: map[string]view.Value{"count": view.CountValue(int64(len(items)))},
		},
		Open: &view.Link{
			Screen: "/reports",
			Params: map[string]string{
				"from": out.From.Format(time.DateOnly),
				"to":   out.To.Format(time.DateOnly),
			},
		},
		Rows: rankingRows(fold),
		Data: treemapData{Total: total, Cells: cells},
	}, nil
}

// treemapCells is one cell per category with an amount, and one for the rest when it holds any.
func treemapCells(fold rankingData) []treemapCell {
	cells := make([]treemapCell, 0, len(fold.Items)+1)
	for _, it := range fold.Items {
		if it.Amount.Amount > 0 {
			cells = append(cells, treemapCell{
				AccountID: it.AccountID,
				Name:      it.Name,
				Amount:    it.Amount,
				ShareBP:   it.ShareBP,
			})
		}
	}

	if fold.Rest != nil && fold.Rest.Amount.Amount > 0 {
		cells = append(cells, treemapCell{
			Name:    "assistantView.ranking.rest",
			Amount:  fold.Rest.Amount,
			ShareBP: fold.Rest.ShareBP,
			Rest:    true,
			Count:   fold.Rest.Count,
		})
	}

	return cells
}

// treemapVerdict names the two largest categories and the share they take together.
func treemapVerdict(cells []treemapCell, total view.Money) view.Text {
	if len(cells) == 0 || cells[0].Rest {
		return view.Text{Key: "assistantView.ranking.empty"}
	}

	if len(cells) == 1 || cells[1].Rest {
		return view.Text{Key: "assistantView.ranking.verdict", Params: map[string]view.Value{
			"name": view.TextValue(
				cells[0].Name,
			),
			"share": view.BPValue(cells[0].ShareBP),
			"total": view.MoneyValue(total),
		}}
	}

	return view.Text{Key: "assistantView.treemap.verdict", Params: map[string]view.Value{
		"first":  view.TextValue(cells[0].Name),
		"second": view.TextValue(cells[1].Name),
		"share": view.BPValue(
			view.Share(cells[0].Amount.Amount+cells[1].Amount.Amount, total.Amount),
		),
		"total": view.MoneyValue(total),
	}}
}

// squarify lays the cells, largest first, in rows whose worst aspect ratio is the lowest
// (Bruls, Huizing and van Wijk, "Squarified Treemaps", 2000).
func squarify(cells []treemapCell, total int64) {
	x, y, w, h := 0.0, 0.0, treeW, treeH
	rest := cells
	left := float64(total)

	for len(rest) > 0 && left > 0 {
		n := bestRow(rest, left, w, h)

		sum := 0.0
		for _, c := range rest[:n] {
			sum += float64(c.Amount.Amount)
		}

		horiz := w >= h

		thick := sum / left * h
		if horiz {
			thick = sum / left * w
		}

		off := 0.0
		for i := range rest[:n] {
			share := float64(rest[i].Amount.Amount) / sum
			if horiz {
				place(&rest[i], x, y+off, thick, share*h)
				off += share * h
			} else {
				place(&rest[i], x+off, y, share*w, thick)
				off += share * w
			}
		}

		if horiz {
			x, w = x+thick, w-thick
		} else {
			y, h = y+thick, h-thick
		}

		left -= sum
		rest = rest[n:]
	}
}

// bestRow is how many leading cells make the row with the lowest worst aspect ratio.
func bestRow(cells []treemapCell, left, w, h float64) int {
	side := min(w, h)
	length := max(w, h)
	best, n, sum := 0.0, 0, 0.0

	for i, c := range cells {
		sum += float64(c.Amount.Amount)
		thick := sum / left * length

		worst := 0.0
		for _, d := range cells[:i+1] {
			l := float64(d.Amount.Amount) / sum * side
			worst = max(worst, thick/l, l/thick)
		}

		if i > 0 && worst > best {
			break
		}

		best, n = worst, i+1
	}

	return n
}

func place(c *treemapCell, x, y, w, h float64) {
	c.X, c.Y, c.W, c.H = x/treeW*100, y/treeH*100, w/treeW*100, h/treeH*100
}
