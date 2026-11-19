package toolapi

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

// helpData is the body of the help form: the screens of the article and their tasks in order.
type helpData struct {
	Topic   string       `json:"topic"`
	Screens []helpScreen `json:"screens"`
}

// Views returns the builders of the assistant's own reads (answer views design, V3).
func Views() map[view.Key]view.Builder {
	return map[view.Key]view.Builder{
		{Tool: "get_help", Form: "help"}: helpView,
	}
}

func helpView(outputs []json.RawMessage, _ view.Select, _ time.Time) (view.Payload, error) {
	var out getHelpOut
	if err := json.Unmarshal(outputs[0], &out); err != nil {
		return view.Payload{}, fmt.Errorf("decode get_help output: %w", err)
	}

	topic := map[string]view.Value{"topic": {Text: out.Topic}}
	p := view.Payload{
		Title:   view.Text{Key: "assistantView.help.title", Params: topic},
		Window:  view.Window{LabelKey: "assistantView.help.window"},
		Verdict: view.Text{Key: "assistantView.help.verdict", Params: topic},
		Rows: view.Table{
			Head: []string{"assistantView.help.screen", "assistantView.help.task"},
			Rows: [][]view.Value{},
		},
		Data: helpData{Topic: out.Topic, Screens: out.Screens},
	}

	for _, s := range out.Screens {
		for _, task := range s.Tasks {
			p.Rows.Rows = append(p.Rows.Rows, []view.Value{{Text: s.Screen}, {Text: task}})
		}
	}

	if len(out.Screens) > 0 {
		p.Open = &view.Link{Screen: out.Screens[0].Path}
	}

	return p, nil
}
