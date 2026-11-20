package toolapi

import (
	"cmp"
	"encoding/json"
	"fmt"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/platform/view"
)

type statementParts struct {
	Purchases    view.Money `json:"purchases"`
	Installments view.Money `json:"installments"`
	Charges      view.Money `json:"charges"`
	Credits      view.Money `json:"credits"`
	Total        view.Money `json:"total"`
}

type statementShare struct {
	CategoryID string     `json:"category_id"`
	Name       string     `json:"name"`
	Total      view.Money `json:"total"`
	ShareBP    int64      `json:"share_bp"`
}

type statementData struct {
	Reference  string           `json:"reference"`
	Parts      statementParts   `json:"parts"`
	Categories []statementShare `json:"categories"`
}

type statementMonth struct {
	Reference string         `json:"reference"`
	Parts     statementParts `json:"parts"`
}

type statementHistoryData struct {
	Statements []statementMonth `json:"statements"`
}

func decodeAnalytics(raw json.RawMessage) (getStatementAnalyticsOut, error) {
	var out getStatementAnalyticsOut
	if err := json.Unmarshal(raw, &out); err != nil {
		return out, fmt.Errorf("decode get_statement_analytics output: %w", err)
	}

	return out, nil
}

// statementView splits one statement by category, largest first, with its parts.
func statementView(outputs []json.RawMessage, _ view.Select, _ time.Time) (view.Payload, error) {
	out, err := decodeAnalytics(outputs[0])
	if err != nil {
		return view.Payload{}, err
	}

	if len(out.Statements) != 1 {
		return view.Payload{}, fmt.Errorf(
			"the read holds %d statements; read one with statement_id",
			len(out.Statements),
		)
	}

	s := out.Statements[0]

	parts, err := partsOf(s.statementPartsView)
	if err != nil {
		return view.Payload{}, err
	}

	data := statementData{Reference: s.Reference, Parts: parts, Categories: []statementShare{}}
	for _, c := range s.Categories {
		total, err := view.Amount(c.Total.Amount, c.Total.Currency)
		if err != nil {
			return view.Payload{}, err
		}

		data.Categories = append(data.Categories, statementShare{
			CategoryID: c.CategoryID,
			Name:       c.CategoryName,
			Total:      total,
			ShareBP:    view.Share(total.Amount, parts.Total.Amount),
		})
	}

	slices.SortStableFunc(data.Categories, func(a, b statementShare) int {
		return cmp.Compare(b.Total.Amount, a.Total.Amount)
	})

	return view.Payload{
		Title:   view.Text{Key: "assistantView.statement.title"},
		Window:  monthWindow(s.Reference),
		Verdict: statementVerdict(data),
		Open:    &view.Link{Screen: "/cards"},
		Rows:    statementRows(data.Categories),
		Data:    data,
	}, nil
}

func statementVerdict(d statementData) view.Text {
	if len(d.Categories) == 0 {
		return view.Text{Key: "assistantView.statement.empty"}
	}

	return view.Text{Key: "assistantView.statement.verdict", Params: map[string]view.Value{
		"name":  view.TextValue(d.Categories[0].Name),
		"share": view.BPValue(d.Categories[0].ShareBP),
		"total": view.MoneyValue(d.Parts.Total),
	}}
}

func statementRows(cats []statementShare) view.Table {
	t := view.Table{
		Head: []string{
			"assistantView.col.category",
			"assistantView.col.total",
			"assistantView.col.share",
		},
		Rows: [][]view.Value{},
	}
	for _, c := range cats {
		t.Rows = append(t.Rows, []view.Value{
			view.TextValue(c.Name), view.MoneyValue(c.Total), view.BPValue(c.ShareBP),
		})
	}

	return t
}

// statementHistoryView draws the closed statements of a card, oldest first, split in purchases,
// installments and charges.
func statementHistoryView(
	outputs []json.RawMessage,
	_ view.Select,
	_ time.Time,
) (view.Payload, error) {
	out, err := decodeAnalytics(outputs[0])
	if err != nil {
		return view.Payload{}, err
	}

	data := statementHistoryData{Statements: []statementMonth{}}
	rows := view.Table{
		Head: []string{
			"assistantView.col.month",
			"assistantView.col.installments",
			"assistantView.col.total",
		},
		Rows: [][]view.Value{},
	}

	for _, s := range out.Statements {
		parts, err := partsOf(s.statementPartsView)
		if err != nil {
			return view.Payload{}, err
		}

		data.Statements = append(
			data.Statements,
			statementMonth{Reference: s.Reference, Parts: parts},
		)
		rows.Rows = append(rows.Rows, []view.Value{
			view.MonthValue(
				s.Reference,
			),
			view.MoneyValue(parts.Installments),
			view.MoneyValue(parts.Total),
		})
	}

	return view.Payload{
		Title:   view.Text{Key: "assistantView.statement_history.title"},
		Window:  historyWindow(data.Statements),
		Verdict: historyVerdict(data.Statements),
		Open:    &view.Link{Screen: "/cards"},
		Rows:    rows,
		Data:    data,
	}, nil
}

func historyWindow(ss []statementMonth) view.Window {
	if len(ss) == 0 {
		return view.Window{}
	}

	return view.Window{From: ss[0].Reference + "-01", To: monthWindow(ss[len(ss)-1].Reference).To}
}

// historyVerdict names the last statement and the share of it installments take.
func historyVerdict(ss []statementMonth) view.Text {
	if len(ss) == 0 {
		return view.Text{Key: "assistantView.statement.empty"}
	}

	last := ss[len(ss)-1]

	return view.Text{Key: "assistantView.statement_history.verdict", Params: map[string]view.Value{
		"month": view.MonthValue(last.Reference),
		"total": view.MoneyValue(last.Parts.Total),
		"installments": view.BPValue(
			view.Share(last.Parts.Installments.Amount, last.Parts.Total.Amount),
		),
	}}
}

func partsOf(p statementPartsView) (statementParts, error) {
	var out statementParts

	for _, f := range []struct {
		to  *view.Money
		src tool.Money
	}{{&out.Purchases, p.Purchases}, {&out.Installments, p.Installments}, {&out.Charges, p.Charges}, {&out.Credits, p.Credits}, {&out.Total, p.Total}} {
		m, err := view.Amount(f.src.Amount, f.src.Currency)
		if err != nil {
			return statementParts{}, err
		}

		*f.to = m
	}

	return out, nil
}
