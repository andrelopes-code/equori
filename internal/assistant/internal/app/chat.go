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
	RetryAt                     time.Time
}

func (s *Service) ChatState(ctx context.Context, userID int64, use Use) (ChatState, error) {
	targets, err := s.Resolve(ctx, userID, true, use)
	if le, ok := errors.AsType[*LimitError](err); ok {
		return ChatState{RetryAt: le.RetryAt}, nil
	}
	if err != nil || len(targets) == 0 {
		return ChatState{}, err
	}
	b, err := s.budget(ctx, userID)
	if err != nil {
		return ChatState{}, err
	}
	now := s.now()
	for _, t := range targets {
		if b.cooling(t, now).IsZero() {
			return ChatState{Available: true, ProviderName: t.ProviderName, Model: t.Model, Notice: string(notice(t.Preset))}, nil
		}
	}
	return ChatState{}, nil
}
