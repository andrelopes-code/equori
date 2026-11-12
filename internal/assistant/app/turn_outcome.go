package app

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
)

func (s *Service) discardProposals(ctx context.Context, booksID int64, state *turnState) {
	if ids := state.take(); len(ids) > 0 {
		// The caller's context may be done; the discard must still reach the database.
		if err := s.repo.DiscardProposals(
			context.WithoutCancel(ctx),
			booksID,
			ids,
			s.now(),
		); err != nil {
			s.log.WarnContext(ctx, "assistant proposals not discarded", "error", err)
		}
	}
}

// failTurn discards the turn's proposals, logs the outcome and stores the unanswered message; a
// canceled turn reports nothing, any other reports err through ev.Error.
func (s *Service) failTurn(
	ctx context.Context,
	ev TurnEvents,
	booksID int64,
	conversationID uuid.UUID,
	state *turnState,
	res AgentResult,
	err error,
	now time.Time,
) error {
	s.discardProposals(ctx, booksID, state)

	outcome := outcomeFailed
	switch {
	case ctx.Err() != nil:
		outcome = outcomeCancel
	case errors.Is(err, ErrChatUnavailable):
		outcome = outcomeUnavail
	default:
		if _, ok := errors.AsType[*LimitError](err); ok {
			outcome = outcomeExhaust
		}
	}

	s.logTurn(ctx, booksID, conversationID, outcome, res, now)

	stored := domain.OutcomeFailed
	if outcome == outcomeCancel {
		stored = domain.OutcomeCanceled
	}

	// The message records that the book's text got no answer; the client may already be gone.
	if _, err := s.repo.AppendMessage(context.WithoutCancel(ctx), booksID, domain.Message{
		ID:             uuid.New(),
		ConversationID: conversationID,
		Role:           domain.RoleAssistant,
		Outcome:        stored,
		CreatedAt:      s.now(),
	}); err != nil {
		s.log.ErrorContext(ctx, "assistant unanswered turn not stored", "error", err)
	}

	if outcome == outcomeCancel {
		return nil
	}

	if outcome == outcomeFailed && !errors.Is(err, ErrTurnFailed) {
		err = fmt.Errorf("%w: %w", ErrTurnFailed, err)
	}

	ev.Error(err)

	return nil
}

// answerTurn stores the answer with its proposals, logs the turn and reports the answer through ev.
func (s *Service) answerTurn(
	ctx context.Context,
	ev TurnEvents,
	booksID, memberID int64,
	conversationID uuid.UUID,
	state *turnState,
	res AgentResult,
	now time.Time,
) error {
	outcome := domain.OutcomeAnswered
	if res.StepLimit {
		outcome = domain.OutcomeStepLimit
	}

	// The answer is stored even when the client left after the model returned: nothing else reads the turn.
	storeCtx := context.WithoutCancel(ctx)

	answer, err := s.repo.AppendMessage(storeCtx, booksID, domain.Message{
		ID:             uuid.New(),
		ConversationID: conversationID,
		Role:           domain.RoleAssistant,
		Outcome:        outcome,
		Content:        truncateRunes(strings.TrimSpace(res.Text), domain.MaxAnswer),
		CreatedAt:      s.now(),
	})
	if err != nil {
		s.discardProposals(ctx, booksID, state)
		return s.failAfterStream(ctx, ev, err)
	}

	ids := state.take()

	out := AnsweredMessage{Message: answer}
	if len(ids) > 0 {
		if err := s.repo.AttachProposals(storeCtx, booksID, answer.ID, ids); err != nil {
			return s.failAfterStream(ctx, ev, err)
		}

		for _, id := range ids {
			p, err := s.repo.Proposal(storeCtx, booksID, memberID, id)
			if err != nil {
				return s.failAfterStream(ctx, ev, err)
			}

			out.Proposals = append(out.Proposals, p)
		}
	}

	s.logTurn(ctx, booksID, conversationID, string(outcome), res, now)
	ev.Answer(out)

	return nil
}

func (s *Service) failAfterStream(ctx context.Context, ev TurnEvents, err error) error {
	s.log.ErrorContext(ctx, "assistant turn storage failed", "error", err)
	ev.Error(fmt.Errorf("%w: %w", ErrTurnFailed, err))

	return nil
}

func (s *Service) logTurn(
	ctx context.Context,
	booksID int64,
	conversationID uuid.UUID,
	outcome string,
	r AgentResult,
	began time.Time,
) {
	s.log.InfoContext(
		ctx,
		"assistant turn",
		"books_id",
		booksID,
		"conversation_id",
		conversationID,
		"steps",
		r.Steps,
		"tool_calls",
		r.ToolCalls,
		"input_tokens",
		r.InputTokens,
		"output_tokens",
		r.OutputTokens,
		"provider",
		r.ProviderName,
		"model",
		r.Model,
		"outcome",
		outcome,
		"restarted",
		r.Restarted,
		"duration",
		s.now().Sub(began),
	)
}
