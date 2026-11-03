package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

var (
	ErrProposalExpired = errors.New("the proposal expired")
	ErrProposalClosed  = errors.New("the proposal was already decided")
	ErrProposalStale   = errors.New("the data changed after the proposal")
	ErrProposalWaiting = errors.New("the proposal waits for another proposal")
)

// ToolFailure is a tool error the model receives as the result of its call.
type ToolFailure struct{ Content []byte }

func (e *ToolFailure) Error() string { return "tool failed" }

// UseTools sets the tool set proposals preview and execute; the chat does not run without it.
func (s *Service) UseTools(t Tools) { s.tools = t }

func (s *Service) logProposal(ctx context.Context, booksID int64, id uuid.UUID, name, decision string) {
	s.log.InfoContext(ctx, "assistant proposal", "books_id", booksID, "proposal_id", id, "tool", name, "decision", decision)
}

// ProposalMeta is the chat metadata of a write call (spec 2026-11-03 §4.1).
type ProposalMeta struct {
	Suggested bool              `json:"suggested,omitzero"`
	Reason    string            `json:"reason,omitzero"`
	Refs      map[string]string `json:"refs,omitzero"`
	Summary   string            `json:"summary,omitzero"`
}

// Propose stores a proposal of a write tool and returns what the model receives: a pending proposal
// with its preview, or a waiting one when it refers to proposals that are not executed yet.
func (s *Service) Propose(ctx context.Context, booksID int64, conversationID uuid.UUID, name string, args json.RawMessage, meta ProposalMeta) (json.RawMessage, error) {
	if err := validateMeta(meta); err != nil {
		return nil, err
	}

	p := domain.Proposal{
		ID: uuid.New(), ConversationID: conversationID, Tool: name, Arguments: args, Status: domain.ProposalPending,
		Suggested: meta.Suggested, Reason: strings.TrimSpace(meta.Reason), Summary: strings.TrimSpace(meta.Summary), Refs: meta.Refs,
	}

	if len(meta.Refs) > 0 {
		parents, err := s.refParents(ctx, booksID, conversationID, args, meta.Refs)
		if err != nil {
			return nil, err
		}

		if err := s.resolveProposal(&p, parents); err != nil {
			return nil, err
		}
	}

	if p.Status == domain.ProposalPending {
		if err := s.preview(ctx, booksID, &p); err != nil {
			return nil, err
		}
	} else if err := s.previewWaiting(&p); err != nil {
		return nil, err
	}

	p.CreatedAt = s.now()
	p.ExpiresAt = p.CreatedAt.Add(domain.ProposalTTL)

	if err := s.repo.InsertProposal(ctx, booksID, p); err != nil {
		return nil, err
	}

	s.logProposal(ctx, booksID, p.ID, name, "created")

	if t, ok := ctx.Value(turnKey{}).(*turnState); ok {
		t.add(p.ID)
	}

	if p.Status == domain.ProposalWaiting {
		return json.Marshal(map[string]any{"proposal_id": p.ID, "status": "waiting_for_confirmation_of", "waiting_for": p.WaitingFor()})
	}

	return json.Marshal(map[string]any{"proposal_id": p.ID, "status": "awaiting_confirmation", "preview": json.RawMessage(p.Preview)})
}

// resolveProposal sets the arguments of p from its executed parents, or marks p waiting after it
// validated the arguments against the schema of the tool.
func (s *Service) resolveProposal(p *domain.Proposal, parents map[uuid.UUID]domain.Proposal) error {
	results := map[uuid.UUID][]byte{}

	for id, parent := range parents {
		if parent.Status != domain.ProposalExecuted {
			res, err := s.tools.Validate(p.Tool, p.Arguments)
			if err != nil {
				return err
			}

			if res.IsError {
				return &ToolFailure{Content: res.Content}
			}

			p.Status = domain.ProposalWaiting

			return nil
		}

		results[id] = parent.Result
	}

	args, missing, err := resolveRefs(p.Arguments, p.Refs, results)
	if err != nil {
		return err
	}

	if missing != "" {
		return argumentFailure("proposal.refs", fmt.Sprintf("%s: the referenced result has no value at %s", missing, resultPointer(p.Refs[missing])))
	}

	p.Arguments = args

	return nil
}

// preview runs the preview of p and stores it with its basis.
func (s *Service) preview(ctx context.Context, booksID int64, p *domain.Proposal) error {
	pv, res, err := s.tools.Preview(auth.WithBooksID(ctx, booksID), p.Tool, p.Arguments)
	if err != nil {
		return err
	}

	if res.IsError {
		return &ToolFailure{Content: res.Content}
	}

	if p.Preview, err = json.Marshal(pv); err != nil {
		return fmt.Errorf("encode preview of %s: %w", p.Tool, err)
	}

	p.Basis = tool.PreviewDigest(pv)

	return nil
}

// previewWaiting gives a waiting proposal the preview without changes; the real preview runs at promotion.
func (s *Service) previewWaiting(p *domain.Proposal) error {
	action := p.Tool

	var in struct {
		Action string `json:"action"`
	}
	if json.Unmarshal(p.Arguments, &in) == nil && in.Action != "" {
		action += "." + in.Action
	}

	var err error

	p.Preview, err = json.Marshal(tool.Preview{Action: action, Changes: []tool.Change{}})

	return err
}

// unclaimed explains why a proposal could not be claimed or rejected.
func (s *Service) unclaimed(ctx context.Context, booksID, memberID int64, id uuid.UUID) error {
	p, err := s.repo.Proposal(ctx, booksID, memberID, id)
	if err != nil {
		return err
	}

	if p.Expired(s.now()) {
		s.logProposal(ctx, booksID, id, p.Tool, "expired")
		return ErrProposalExpired
	}

	if p.Status == domain.ProposalWaiting {
		return ErrProposalWaiting
	}

	return ErrProposalClosed
}

// Confirm executes a pending proposal at most once (spec 8.2).
func (s *Service) Confirm(ctx context.Context, booksID, memberID int64, id uuid.UUID) (domain.Proposal, error) {
	now := s.now()

	p, ok, err := s.repo.ClaimProposal(ctx, booksID, memberID, id, now)
	if err != nil {
		return domain.Proposal{}, err
	}

	if !ok {
		return domain.Proposal{}, s.unclaimed(ctx, booksID, memberID, id)
	}

	ctx = auth.WithBooksID(ctx, booksID)

	pv, res, err := s.tools.Preview(ctx, p.Tool, p.Arguments)
	if err != nil {
		return domain.Proposal{}, err
	}

	if res.IsError || tool.PreviewDigest(pv) != p.Basis {
		if err := s.repo.DecideProposal(ctx, booksID, id, domain.ProposalStale, nil, now); err != nil {
			return domain.Proposal{}, err
		}

		s.logProposal(ctx, booksID, id, p.Tool, "stale")

		if err := s.block(ctx, booksID, p.ConversationID, id); err != nil {
			return domain.Proposal{}, err
		}

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

	if err := s.repo.DecideProposal(ctx, booksID, id, status, res.Content, now); err != nil {
		return domain.Proposal{}, err
	}

	s.logProposal(ctx, booksID, id, p.Tool, decision)
	p.Status, p.Result, p.DecidedAt = status, res.Content, now

	if status == domain.ProposalExecuted {
		return p, s.promote(ctx, booksID, p.ConversationID)
	}

	return p, s.block(ctx, booksID, p.ConversationID, id)
}

// Reject closes a pending proposal without executing it.
func (s *Service) Reject(ctx context.Context, booksID, memberID int64, id uuid.UUID) (domain.Proposal, error) {
	ok, err := s.repo.RejectProposal(ctx, booksID, memberID, id, s.now())
	if err != nil {
		return domain.Proposal{}, err
	}

	if !ok {
		return domain.Proposal{}, s.unclaimed(ctx, booksID, memberID, id)
	}

	p, err := s.repo.Proposal(ctx, booksID, memberID, id)
	if err != nil {
		return domain.Proposal{}, err
	}

	s.logProposal(ctx, booksID, id, p.Tool, "rejected")

	return p, s.block(ctx, booksID, p.ConversationID, id)
}
