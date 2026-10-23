package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/assistant/internal/guide"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type getHelpTopic string

func (getHelpTopic) Values() []string { return guide.Topics() }

type getHelpIn struct {
	Topic getHelpTopic `json:"topic" jsonschema:"article to return"`
}

type helpScreen struct {
	Path   string   `json:"path" jsonschema:"route of the screen; a $name segment stands for an ID"`
	Screen string   `json:"screen" jsonschema:"English name of the screen"`
	Tasks  []string `json:"tasks" jsonschema:"what is done there"`
}

type getHelpOut struct {
	Topic   string       `json:"topic"`
	Article string       `json:"article" jsonschema:"Markdown text of the article"`
	Screens []helpScreen `json:"screens" jsonschema:"screens of the topic; empty when the topic has none"`
}

func getHelp(screens []guide.Screen) tool.Tool {
	return tool.New(tool.Spec{
		Name:        "get_help",
		Description: "Returns an article of the equori guide: what a concept means in this app, how a task is done, and the screens where it is done with their paths. Use it for how-to and where-is questions, for concepts such as postings, statements or reconciliation, and for tasks the assistant cannot do, such as adding bank credentials or importing a file. Do not use it for the user's own data: the other tools return it.",
		Effect:      tool.ReadOnly,
		Idempotent:  true,
	}, func(_ context.Context, _ int64, in getHelpIn) (getHelpOut, error) {
		article, ok := guide.Article(string(in.Topic))
		if !ok {
			return getHelpOut{}, tool.InvalidArgument("topic", "is not an article of the guide")
		}
		out := getHelpOut{Topic: string(in.Topic), Article: article, Screens: []helpScreen{}}
		for _, s := range screens {
			for _, topic := range s.Topics {
				if topic == string(in.Topic) {
					out.Screens = append(out.Screens, helpScreen{Path: s.Path, Screen: s.Screen, Tasks: s.Tasks})
					break
				}
			}
		}
		return out, nil
	})
}
