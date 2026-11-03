package llmapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type chatSet struct {
	tool.Set
	effects map[string]tool.Effect
}

func (c chatSet) Effect(name string) (tool.Effect, bool) {
	e, ok := c.effects[name]
	return e, ok
}

// NewChatSet refuses a tool that writes and has no preview (spec 8.1).
func NewChatSet(set tool.Set) (app.Tools, error) {
	effects := map[string]tool.Effect{}
	for _, t := range set.Tools() {
		s := t.Spec()
		if s.Effect != tool.ReadOnly && !t.HasPreview() {
			return nil, fmt.Errorf("chat tool %s writes and has no preview", s.Name)
		}

		effects[s.Name] = s.Effect
	}

	return chatSet{Set: set, effects: effects}, nil
}

// ChatHandlers returns the declarations and handlers of the chat: read tools run, write tools
// store a proposal in the conversation that conversationID reads from the context.
func ChatHandlers(svc *app.Service, tools app.Tools, set tool.Set, conversationID func(context.Context) uuid.UUID) ([]llm.Tool, map[string]llm.ToolHandler) {
	decls, handlers := set.LLM()
	for i, d := range decls {
		name := d.Name
		if e, _ := tools.Effect(name); e == tool.ReadOnly {
			continue
		}

		decls[i].Parameters = withProposal(d.Parameters)

		handlers[name] = func(ctx context.Context, args json.RawMessage) (json.RawMessage, error) {
			args, meta, err := splitProposal(args)
			if err != nil {
				return nil, err
			}

			out, err := svc.Propose(ctx, auth.MustBooksID(ctx), conversationID(ctx), name, args, meta)
			if tf, ok := errors.AsType[*app.ToolFailure](err); ok {
				return nil, &llm.ToolError{Content: tf.Content}
			}

			return out, err
		}
	}

	return decls, handlers
}

// proposalProperty is the schema of the chat property proposal (spec 2026-11-03 §4.1).
const proposalProperty = `{"type":"object","additionalProperties":false,` +
	`"description":"Chat metadata of this proposal; see the system prompt, section Changes.",` +
	`"properties":{"suggested":{"type":"boolean"},` +
	`"reason":{"type":"string","maxLength":200},` +
	`"refs":{"type":"object","additionalProperties":{"type":"string","pattern":"^[0-9a-f-]{36}(#/[a-z0-9_/]+)?$"}},` +
	`"summary":{"type":"string","maxLength":200}}}`

// withProposal returns schema with the property proposal added; a schema that is not an object is returned as is.
func withProposal(schema json.RawMessage) json.RawMessage {
	var s map[string]json.RawMessage
	if json.Unmarshal(schema, &s) != nil {
		return schema
	}

	props := map[string]json.RawMessage{}
	if raw, ok := s["properties"]; ok && json.Unmarshal(raw, &props) != nil {
		return schema
	}

	props["proposal"] = json.RawMessage(proposalProperty)
	s["properties"], _ = json.Marshal(props)

	out, err := json.Marshal(s)
	if err != nil {
		return schema
	}

	return out
}

// splitProposal removes the chat property proposal from args and decodes it.
func splitProposal(args json.RawMessage) (json.RawMessage, app.ProposalMeta, error) {
	var fields map[string]json.RawMessage
	if json.Unmarshal(args, &fields) != nil || fields["proposal"] == nil {
		return args, app.ProposalMeta{}, nil
	}

	var meta app.ProposalMeta
	if err := json.Unmarshal(fields["proposal"], &meta); err != nil {
		content, _ := json.Marshal(tool.InvalidArgument("proposal", "must be an object with suggested, reason, refs and summary"))
		return nil, app.ProposalMeta{}, &llm.ToolError{Content: content}
	}

	delete(fields, "proposal")

	rest, err := json.Marshal(fields)

	return rest, meta, err
}
