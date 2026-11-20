package toolapi

import (
	"cmp"
	"encoding/json"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

type explainItem struct {
	TransactionID string `json:"transaction_id"`
	Method        string `json:"method"`
	RuleName      string `json:"rule_name,omitempty"`
	DecidedAt     string `json:"decided_at"`
}

type explainData struct {
	Items []explainItem `json:"items"`
}

type methodShare struct {
	Method  string `json:"method"`
	Count   int64  `json:"count"`
	ShareBP int64  `json:"share_bp"`
}

type categorizationData struct {
	From    string        `json:"from"`
	To      string        `json:"to"`
	Total   int64         `json:"total"`
	Methods []methodShare `json:"methods"`
}

// Views returns the builders of the classification reads (answer views design, V3).
func Views() map[view.Key]view.Builder {
	return map[view.Key]view.Builder{
		{Tool: "explain_categorization", Form: "explain"}:        explainView,
		{Tool: "explain_categorization", Form: "categorization"}: categorizationFormView,
	}
}

func decodeExplain(raw json.RawMessage) (explainCategorizationOut, error) {
	var out explainCategorizationOut
	if err := json.Unmarshal(raw, &out); err != nil {
		return out, fmt.Errorf("decode explain_categorization output: %w", err)
	}

	return out, nil
}

// explainView draws how each transaction got its category: the method and, for a rule, its name.
func explainView(outputs []json.RawMessage, _ view.Select, _ time.Time) (view.Payload, error) {
	out, err := decodeExplain(outputs[0])
	if err != nil {
		return view.Payload{}, err
	}

	data := explainData{Items: []explainItem{}}
	rows := view.Table{
		Head: []string{"assistantView.col.method", "assistantView.col.rule"},
		Rows: [][]view.Value{},
	}

	for _, it := range out.Items {
		method := cmp.Or(it.Method, "uncategorized")
		data.Items = append(
			data.Items,
			explainItem{
				TransactionID: it.TransactionID,
				Method:        method,
				RuleName:      it.RuleName,
				DecidedAt:     it.DecidedAt,
			},
		)
		rows.Rows = append(
			rows.Rows,
			[]view.Value{
				view.TextValue("assistantView.method." + method),
				view.TextValue(it.RuleName),
			},
		)
	}

	return view.Payload{
		Title:   view.Text{Key: "assistantView.explain.title"},
		Verdict: explainVerdict(data.Items),
		Open:    &view.Link{Screen: "/categories/rules"},
		Rows:    rows,
		Data:    data,
	}, nil
}

func explainVerdict(items []explainItem) view.Text {
	if len(items) == 0 {
		return view.Text{Key: "assistantView.explain.empty"}
	}

	first := items[0]
	if first.Method == "rule" && first.RuleName != "" {
		return view.Text{
			Key:    "assistantView.explain.verdict_rule",
			Params: map[string]view.Value{"rule": view.TextValue(first.RuleName)},
		}
	}

	return view.Text{Key: "assistantView.explain.verdict_" + first.Method}
}

// categorizationFormView splits the categorized transactions of a period by how they got their
// category.
func categorizationFormView(
	outputs []json.RawMessage,
	_ view.Select,
	_ time.Time,
) (view.Payload, error) {
	out, err := decodeExplain(outputs[0])
	if err != nil {
		return view.Payload{}, err
	}

	st := out.Statistics
	data := categorizationData{
		From:    st.From.Format(time.DateOnly),
		To:      st.To.Format(time.DateOnly),
		Total:   int64(st.Total),
		Methods: methodShares(st),
	}

	return view.Payload{
		Title:   view.Text{Key: "assistantView.categorization.title"},
		Window:  view.Window{From: data.From, To: data.To},
		Verdict: categorizationVerdict(st),
		Open:    &view.Link{Screen: "/categories/rules"},
		Rows:    categorizationRows(data.Methods),
		Data:    data,
	}, nil
}

func methodShares(st statisticsView) []methodShare {
	out := []methodShare{}
	for _, m := range []struct {
		name  string
		count int
	}{
		{"rule", st.Rule},
		{"source", st.Source},
		{"history", st.History},
		{"manual", st.Manual},
		{"uncategorized", st.Uncategorized},
	} {
		out = append(out, methodShare{
			Method:  m.name,
			Count:   int64(m.count),
			ShareBP: view.Share(int64(m.count), int64(st.Total)),
		})
	}

	return out
}

// categorizationVerdict gives the share the book categorized by itself and what still waits.
func categorizationVerdict(st statisticsView) view.Text {
	if st.Total == 0 {
		return view.Text{Key: "assistantView.explain.empty"}
	}

	auto := int64(st.Rule + st.Source + st.History)

	return view.Text{Key: "assistantView.categorization.verdict", Params: map[string]view.Value{
		"share": view.BPValue(view.Share(auto, int64(st.Total))),
		"total": view.CountValue(int64(st.Total)),
		"open":  view.CountValue(int64(st.Uncategorized)),
	}}
}

func categorizationRows(methods []methodShare) view.Table {
	t := view.Table{
		Head: []string{
			"assistantView.col.method",
			"assistantView.col.count",
			"assistantView.col.share",
		},
		Rows: [][]view.Value{},
	}
	for _, m := range methods {
		t.Rows = append(t.Rows, []view.Value{
			view.TextValue("assistantView.method." + m.Method),
			view.CountValue(m.Count),
			view.BPValue(m.ShareBP),
		})
	}

	return t
}
