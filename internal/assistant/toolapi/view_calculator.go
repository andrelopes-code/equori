package toolapi

import (
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

type calculatorInputView struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type calculatorData struct {
	Title  string                `json:"title"`
	Path   string                `json:"path"`
	Inputs []calculatorInputView `json:"inputs"`
}

// calculatorView draws a calculator the model filled: its name, the inputs read from the link's
// query, and the link that opens it with them; the calculator computes, the view does not.
func calculatorView(outputs []json.RawMessage, _ view.Select, _ time.Time) (view.Payload, error) {
	var out openCalculatorOut
	if err := json.Unmarshal(outputs[0], &out); err != nil {
		return view.Payload{}, fmt.Errorf("decode open_calculator output: %w", err)
	}

	u, err := url.Parse(out.Path)
	if err != nil {
		return view.Payload{}, fmt.Errorf("parse calculator path: %w", err)
	}

	data := calculatorData{Title: out.Title, Path: u.Path, Inputs: []calculatorInputView{}}
	rows := view.Table{
		Head: []string{"assistantView.col.input", "assistantView.col.value"},
		Rows: [][]view.Value{},
	}
	params := map[string]string{}

	for key, values := range u.Query() {
		params[key] = values[0]
	}

	for _, key := range sortedKeys(params) {
		data.Inputs = append(data.Inputs, calculatorInputView{Key: key, Value: params[key]})
		rows.Rows = append(
			rows.Rows,
			[]view.Value{view.TextValue(key), view.TextValue(params[key])},
		)
	}

	return view.Payload{
		Title: view.Text{
			Key:    "assistantView.calculator.title",
			Params: map[string]view.Value{"name": view.TextValue(out.Title)},
		},
		Verdict: view.Text{
			Key:    "assistantView.calculator.verdict",
			Params: map[string]view.Value{"count": view.CountValue(int64(len(data.Inputs)))},
		},
		Open: &view.Link{Screen: u.Path, Params: params},
		Rows: rows,
		Data: data,
	}, nil
}
