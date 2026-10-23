package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

var (
	ErrProposalExpired = errors.New("the proposal expired")
	ErrProposalClosed  = errors.New("the proposal was already decided")
	ErrProposalStale   = errors.New("the data changed after the proposal")
)

// ToolFailure is a tool error the model receives as the result of its call.
type ToolFailure struct{ Content []byte }

func (e *ToolFailure) Error() string { return "tool failed" }

// UseTools sets the tool set proposals preview and execute; the chat does not run without it.
func (s *Service) UseTools(t Tools) { s.tools = t }

func (s *Service) logProposal(ctx context.Context, userID int64, id uuid.UUID, name, decision string) {
	s.log.InfoContext(ctx, "assistant proposal", "user_id", userID, "proposal_id", id, "tool", name, "decision", decision)
}

// Propose stores a pending proposal of a write tool and returns what the model receives.
func (s *Service) Propose(ctx context.Context, userID int64, conversationID uuid.UUID, name string, args json.RawMessage) (json.RawMessage, error) {
	pv, res, err := s.tools.Preview(auth.WithUserID(ctx, userID), name, args)
	if err != nil {
		return nil, err
	}
	if res.IsError {
		return nil, &ToolFailure{Content: res.Content}
	}
	preview, err := json.Marshal(pv)
	if err != nil {
		return nil, fmt.Errorf("encode preview of %s: %w", name, err)
	}
	now := s.now()
	p := domain.Proposal{
		ID: uuid.New(), ConversationID: conversationID, Tool: name, Arguments: args, Preview: preview,
		Basis: tool.PreviewDigest(pv), Status: domain.ProposalPending, CreatedAt: now, ExpiresAt: now.Add(domain.ProposalTTL),
	}
	if err := s.repo.InsertProposal(ctx, userID, p); err != nil {
		return nil, err
	}
	s.logProposal(ctx, userID, p.ID, name, "created")
	if t, ok := ctx.Value(turnKey{}).(*turnState); ok {
		t.add(p.ID)
	}
	return json.Marshal(map[string]any{"proposal_id": p.ID, "status": "awaiting_confirmation", "preview": json.RawMessage(preview)})
}

// unclaimed explains why a proposal could not be claimed or rejected.
func (s *Service) unclaimed(ctx context.Context, userID int64, id uuid.UUID) error {
	p, err := s.repo.Proposal(ctx, userID, id)
	if err != nil {
		return err
	}
	if p.Expired(s.now()) {
		s.logProposal(ctx, userID, id, p.Tool, "expired")
		return ErrProposalExpired
	}
	return ErrProposalClosed
}

// Confirm executes a pending proposal at most once (spec 8.2).
func (s *Service) Confirm(ctx context.Context, userID int64, id uuid.UUID) (domain.Proposal, error) {
	now := s.now()
	p, ok, err := s.repo.ClaimProposal(ctx, userID, id, now)
	if err != nil {
		return domain.Proposal{}, err
	}
	if !ok {
		return domain.Proposal{}, s.unclaimed(ctx, userID, id)
	}
	ctx = auth.WithUserID(ctx, userID)
	pv, res, err := s.tools.Preview(ctx, p.Tool, p.Arguments)
	if err != nil {
		return domain.Proposal{}, err
	}
	if res.IsError || tool.PreviewDigest(pv) != p.Basis {
		if err := s.repo.DecideProposal(ctx, userID, id, domain.ProposalStale, nil, now); err != nil {
			return domain.Proposal{}, err
		}
		s.logProposal(ctx, userID, id, p.Tool, "stale")
		return domain.Proposal{}, ErrProposalStale
	}
	res, err = s.tools.Call(ctx, p.Tool, p.Arguments)
	if err != nil {
		return domain.Proposal{}, err
	}
	status, decision := domain.ProposalExecuted, "executed"
	if res.IsError {
		status, decision = domain.ProposalFailed, "failed"
	}
	if err := s.repo.DecideProposal(ctx, userID, id, status, res.Content, now); err != nil {
		return domain.Proposal{}, err
	}
	s.logProposal(ctx, userID, id, p.Tool, decision)
	p.Status, p.Result, p.DecidedAt = status, res.Content, now
	return p, nil
}

// Reject closes a pending proposal without executing it.
func (s *Service) Reject(ctx context.Context, userID int64, id uuid.UUID) (domain.Proposal, error) {
	ok, err := s.repo.RejectProposal(ctx, userID, id, s.now())
	if err != nil {
		return domain.Proposal{}, err
	}
	if !ok {
		return domain.Proposal{}, s.unclaimed(ctx, userID, id)
	}
	p, err := s.repo.Proposal(ctx, userID, id)
	if err != nil {
		return domain.Proposal{}, err
	}
	s.logProposal(ctx, userID, id, p.Tool, "rejected")
	return p, nil
}
