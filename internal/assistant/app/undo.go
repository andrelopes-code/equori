package app

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

var (
	ErrProposalNotUndoable = errors.New("the proposal has no inverse to run")
	ErrProposalUndone      = domain.ErrProposalUndone
	ErrInvalidUndoReason   = errors.New("reason must have 1 to 200 characters")
)

// Undo runs the write that reverses an executed proposal, as a proposal of the same answer that
// the member's request confirms (answer views design V19). An inverse that fails returns a failed
// proposal and leaves p undoable.
func (s *Service) Undo(
	ctx context.Context,
	booksID, memberID int64,
	id uuid.UUID,
	reason string,
) (domain.Proposal, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" || utf8.RuneCountInString(reason) > 200 {
		return domain.Proposal{}, ErrInvalidUndoReason
	}

	p, err := s.repo.Proposal(ctx, booksID, memberID, id)
	if err != nil {
		return domain.Proposal{}, err
	}

	inverse, ok, err := s.inverse(p, reason)
	if err != nil {
		return domain.Proposal{}, err
	}

	if !ok {
		return domain.Proposal{}, ErrProposalNotUndoable
	}

	q, err := s.proposeUndo(ctx, booksID, p, inverse)
	if err != nil || q.Status == domain.ProposalFailed {
		return q, err
	}

	return s.Confirm(ctx, booksID, memberID, q.ID)
}

// Undoable reports whether Undo would run an inverse for p: p is executed, is not itself an undo,
// and its tool derives an inverse from its call.
func (s *Service) Undoable(p domain.Proposal) bool {
	_, ok, err := s.inverse(p, "-")
	return ok && err == nil && p.UndoneBy == uuid.Nil
}

func (s *Service) inverse(p domain.Proposal, reason string) (tool.Undo, bool, error) {
	if p.Status != domain.ProposalExecuted || p.Undoes != uuid.Nil {
		return tool.Undo{}, false, nil
	}

	return s.tools.Undo(p.Tool, p.Arguments, p.Result, reason)
}

// proposeUndo stores the pending undo of p. An inverse whose preview fails is stored failed, with
// the tool error as its result.
func (s *Service) proposeUndo(
	ctx context.Context,
	booksID int64,
	p domain.Proposal,
	inverse tool.Undo,
) (domain.Proposal, error) {
	now := s.now()
	q := domain.Proposal{
		ID:             uuid.New(),
		ConversationID: p.ConversationID,
		MessageID:      p.MessageID,
		Tool:           inverse.Tool,
		Arguments:      inverse.Arguments,
		Status:         domain.ProposalPending,
		Undoes:         p.ID,
		CreatedAt:      now,
		ExpiresAt:      now.Add(domain.ProposalTTL),
	}

	err := s.preview(ctx, booksID, &q)
	if tf, ok := errors.AsType[*ToolFailure](err); ok {
		empty := tool.Preview{Action: inverse.Tool, Changes: []tool.Change{}}
		q.Preview, _ = json.Marshal(empty)
		q.Basis = tool.PreviewDigest(empty)
		q.Status, q.Result, q.DecidedAt = domain.ProposalFailed, tf.Content, now
	} else if err != nil {
		return domain.Proposal{}, err
	}

	if err := s.repo.InsertProposal(ctx, booksID, q); err != nil {
		return domain.Proposal{}, err
	}

	s.logProposal(ctx, booksID, q.ID, q.Tool, "undo of "+p.ID.String())

	return q, nil
}

// markUndone sets UndoneBy on each proposal that an executed undo of ps reverses.
func markUndone(ps []domain.Proposal) {
	by := map[uuid.UUID]uuid.UUID{}
	for _, q := range ps {
		if q.Undoes != uuid.Nil && q.Status == domain.ProposalExecuted {
			by[q.Undoes] = q.ID
		}
	}

	for i := range ps {
		ps[i].UndoneBy = by[ps[i].ID]
	}
}
