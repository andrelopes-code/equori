package toolapi

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/assistant/app"
)

// helpData is the body of the help form: the screens of the article and their tasks in order.
type helpData struct {
	Topic   string       `json:"topic"`
	Screens []helpScreen `json:"screens"`
}

// Views returns the builders of the assistant's own reads (answer views design, V3).
func Views() map[app.ViewKey]app.ViewBuilder {
	return map[app.ViewKey]app.ViewBuilder{
		{Tool: "get_help", Form: "help"}: helpView,
	}
}

func helpView(outputs []json.RawMessage, _ app.ViewSelect, _ time.Time) (app.ViewPayload, error) {
	var out getHelpOut
	if err := json.Unmarshal(outputs[0], &out); err != nil {
		return app.ViewPayload{}, fmt.Errorf("decode get_help output: %w", err)
	}

	topic := map[string]app.ViewValue{"topic": {Text: out.Topic}}
	p := app.ViewPayload{
		Title:   app.ViewText{Key: "assistantView.help.title", Params: topic},
		Window:  app.ViewWindow{LabelKey: "assistantView.help.window"},
		Verdict: app.ViewText{Key: "assistantView.help.verdict", Params: topic},
		Rows: app.ViewTable{
			Head: []string{"assistantView.help.screen", "assistantView.help.task"},
			Rows: [][]app.ViewValue{},
		},
		Data: helpData{Topic: out.Topic, Screens: out.Screens},
	}

	for _, s := range out.Screens {
		for _, task := range s.Tasks {
			p.Rows.Rows = append(p.Rows.Rows, []app.ViewValue{{Text: s.Screen}, {Text: task}})
		}
	}

	if len(out.Screens) > 0 {
		p.Open = &app.ViewLink{Screen: out.Screens[0].Path}
	}

	return p, nil
}
