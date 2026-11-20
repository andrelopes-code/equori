package app

import (
	"context"
	"errors"
	"time"
)

// ChatState tells whether the conversational use can be called now and through which target.
type ChatState struct {
	Available                   bool
	ProviderName, Model, Notice string
	// ReadsFiles tells that a model of the chat reads a pdf, image or text file (F5, FU4).
	ReadsFiles bool
	RetryAt    time.Time
	// Targets are the targets a turn may choose, in chain order (model choice MC1).
	Targets []ChatTarget
}

// ChatTarget is one target of the chat with the notice of its preset.
type ChatTarget struct {
	ProviderID, ProviderName, Model, Notice string
	ReadsFiles                              bool
}

func (s *Service) ChatState(ctx context.Context, booksID int64, use Use) (ChatState, error) {
	targets, err := s.Resolve(ctx, booksID, true, use)
	if le, ok := errors.AsType[*LimitError](err); ok {
		return ChatState{RetryAt: le.RetryAt}, nil
	}

	if err != nil || len(targets) == 0 {
		return ChatState{}, err
	}

	b, err := s.budget(ctx, booksID)
	if err != nil {
		return ChatState{}, err
	}

	now := s.now()
	for _, t := range targets {
		if !b.cooling(t, now).IsZero() {
			continue
		}

		reads, err := s.chatReadsFiles(ctx, booksID)
		if err != nil {
			return ChatState{}, err
		}

		return ChatState{
			Available:    true,
			ProviderName: t.ProviderName,
			Model:        t.Model,
			Notice:       string(notice(t.Preset)),
			ReadsFiles:   reads,
			Targets:      chatTargets(targets),
		}, nil
	}

	return ChatState{}, nil
}

func chatTargets(targets []Target) []ChatTarget {
	out := make([]ChatTarget, len(targets))
	for i, t := range targets {
		out[i] = ChatTarget{
			ProviderID:   t.ProviderID,
			ProviderName: t.ProviderName,
			Model:        t.Model,
			Notice:       string(notice(t.Preset)),
			ReadsFiles:   readsFiles(t),
		}
	}

	return out
}
