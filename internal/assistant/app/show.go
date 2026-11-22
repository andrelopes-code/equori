package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	pview "github.com/andrelopes-code/equori/internal/platform/view"
)

// Limits of the chips the model proposes under a view (V2).
const (
	maxNext      = 3
	maxNextRunes = 60
)

// How many handles of one tool a form takes (V2a): two periods to compare, or up to four pages of
// a list; every other form takes one.
var sourceCounts = map[string][2]int{
	"compare":  {2, 2},
	"changes":  {2, 2},
	"txs":      {1, maxPages},
	"outliers": {1, maxPages},
	"heat":     {1, maxPages},
	"figure":   {1, 2},
	chartForm:  {1, maxPages},
}

// chartForm draws a chart the model describes over any read (answer views design, V27).
const chartForm = "chart"

// The pages of one list a view joins.
const maxPages = 4

type showArgs struct {
	Source []string         `json:"source"`
	Form   string           `json:"form"`
	Select ViewSelect       `json:"select"`
	Chart  *pview.ChartSpec `json:"chart"`
	Next   []string         `json:"next"`
}

// StampRead keeps the output of a read of the turn and returns it with its handle in view_source
// (V1). An output that is not a JSON object, or that the turn cannot keep, returns unchanged.
func (s *Service) StampRead(ctx context.Context, name string, out json.RawMessage) json.RawMessage {
	t, ok := ctx.Value(turnKey{}).(*turnState)
	if !ok {
		return out
	}

	var fields map[string]json.RawMessage
	if json.Unmarshal(out, &fields) != nil || fields == nil {
		return out
	}

	handle, ok := t.addRead(name, out)
	if !ok {
		return out
	}

	fields["view_source"], _ = json.Marshal(handle)

	stamped, err := json.Marshal(fields)
	if err != nil {
		return out
	}

	return stamped
}

// Show builds the view of an earlier read of the turn and keeps it for the answer (V2 to V5).
func (s *Service) Show(ctx context.Context, args json.RawMessage) (json.RawMessage, error) {
	t, ok := ctx.Value(turnKey{}).(*turnState)
	if !ok {
		return nil, errors.New("show runs only inside a turn")
	}

	var in showArgs
	if err := json.Unmarshal(args, &in); err != nil {
		return nil, showFailure("source", "must be an object with source, form, select and next")
	}

	toolName, outputs, err := s.showSources(t, in)
	if err != nil {
		return nil, err
	}

	build, ok := s.views[ViewKey{Tool: toolName, Form: in.Form}]
	if in.Form == chartForm {
		build, ok = chartBuilder(in.Chart), true
	}

	if !ok {
		forms := strings.Join(s.FormsOf(toolName), ", ")

		return nil, showFailure(
			"form",
			fmt.Sprintf("is not a form of %s; its forms: %s", toolName, forms),
		)
	}

	payload, err := s.buildView(ctx, build, outputs, in)
	if err != nil {
		return nil, err
	}

	v := domain.View{ID: uuid.New(), Form: in.Form, Payload: payload, CreatedAt: s.now()}
	if err := t.addView(v); err != nil {
		return nil, showFailure("form", err.Error())
	}

	return json.Marshal(map[string]string{"view": v.ID.String()})
}

// showSources resolves the handles of in to the outputs of one tool.
func (s *Service) showSources(t *turnState, in showArgs) (string, []json.RawMessage, error) {
	count, ok := sourceCounts[in.Form]
	if !ok {
		count = [2]int{1, 1}
	}

	if len(in.Source) < count[0] || len(in.Source) > count[1] {
		return "", nil, showFailure(
			"source",
			fmt.Sprintf("takes %d to %d handle(s) for form %s", count[0], count[1], in.Form),
		)
	}

	var toolName string

	outputs := make([]json.RawMessage, 0, len(in.Source))
	for i, h := range in.Source {
		name, out, ok := t.read(h)
		if !ok {
			return "", nil, showFailure(
				"source",
				fmt.Sprintf("%s is not a read of this turn; its reads: %s", h, t.handles()),
			)
		}

		if toolName != "" && name != toolName {
			return "", nil, showFailure("source", "handles must name reads of the same tool")
		}

		if slices.Contains(in.Source[:i], h) {
			return "", nil, showFailure("source", h+" is given twice")
		}

		toolName = name

		outputs = append(outputs, out)
	}

	return toolName, outputs, nil
}

func (s *Service) buildView(
	ctx context.Context,
	build ViewBuilder,
	outputs []json.RawMessage,
	in showArgs,
) (json.RawMessage, error) {
	if len(in.Next) > maxNext {
		return nil, showFailure("next", fmt.Sprintf("holds at most %d questions", maxNext))
	}

	for _, n := range in.Next {
		if n == "" || utf8.RuneCountInString(n) > maxNextRunes {
			return nil, showFailure(
				"next",
				fmt.Sprintf("questions have 1 to %d characters", maxNextRunes),
			)
		}
	}

	today := clock.DateOf(s.now(), clock.Location(ctx))

	p, err := build(outputs, in.Select, today)
	if err != nil {
		field := "source"
		if in.Form == chartForm {
			field = chartForm
		}

		return nil, showFailure(field, err.Error())
	}

	p.Next = in.Next
	if p.Next == nil {
		p.Next = []string{}
	}

	return json.Marshal(p)
}

// chartBuilder builds the chart spec describes; a missing spec is the builder's error.
func chartBuilder(spec *pview.ChartSpec) ViewBuilder {
	return func(outputs []json.RawMessage, _ ViewSelect, _ time.Time) (ViewPayload, error) {
		if spec == nil {
			return ViewPayload{}, errors.New("form chart takes a chart spec")
		}

		return pview.Chart(outputs, *spec)
	}
}

func showFailure(field, message string) error {
	content, _ := json.Marshal(tool.InvalidArgument(field, message))
	return &ToolFailure{Content: content}
}
