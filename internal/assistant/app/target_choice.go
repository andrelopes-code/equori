package app

import (
	"context"
	"errors"
	"slices"
)

// ErrTargetUnknown reports a chosen target that is not among the targets of the chat (model choice MC4).
var ErrTargetUnknown = errors.New("the chosen target is not in the chain of the assistant")

// TargetChoice is the target a member chose for one turn (model choice MC2).
type TargetChoice struct {
	ProviderID, Model string
}

type choiceKey struct{}

// choice is a TargetChoice bound to the use it restricts, so other uses of the turn keep their chain.
type choice struct {
	useID string
	TargetChoice
}

func withChoice(ctx context.Context, useID string, c *TargetChoice) context.Context {
	if c == nil {
		return ctx
	}

	return context.WithValue(ctx, choiceKey{}, choice{useID: useID, TargetChoice: *c})
}

// chosen keeps the chosen target alone when ctx carries a choice for the use.
func chosen(ctx context.Context, useID string, targets []Target) ([]Target, error) {
	c, ok := ctx.Value(choiceKey{}).(choice)
	if !ok || c.useID != useID {
		return targets, nil
	}

	i := slices.IndexFunc(targets, func(t Target) bool {
		return t.ProviderID == c.ProviderID && t.Model == c.Model
	})
	if i < 0 {
		return nil, ErrTargetUnknown
	}

	return targets[i : i+1], nil
}
