package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Limits of the chips the model proposes under a view (V2).
const (
	maxNext      = 3
	maxNextRunes = 60
)

// The forms that compare two reads of the same tool take two handles (V2a).
var twoSourceForms = map[string]bool{"compare": true, "changes": true}

type showArgs struct {
	Source []string   `json:"source"`
	Form   string     `json:"form"`
	Select ViewSelect `json:"select"`
	Next   []string   `json:"next"`
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
	want := 1
	if twoSourceForms[in.Form] {
		want = 2
	}

	if len(in.Source) != want {
		return "", nil, showFailure(
			"source",
			fmt.Sprintf("takes %d handle(s) for form %s", want, in.Form),
		)
	}

	var toolName string
	outputs := make([]json.RawMessage, 0, want)
	for _, h := range in.Source {
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
		return nil, showFailure("source", err.Error())
	}

	p.Next = in.Next
	if p.Next == nil {
		p.Next = []string{}
	}

	return json.Marshal(p)
}

func showFailure(field, message string) error {
	content, _ := json.Marshal(tool.InvalidArgument(field, message))
	return &ToolFailure{Content: content}
}
