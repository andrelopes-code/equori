package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

// toProposal converts a stored proposal; a pending or waiting proposal past its expiry reads as expired.
func (s *Server) toProposal(p domain.Proposal) (AssistantProposal, error) {
	out := AssistantProposal{
		Id: p.ID, Tool: p.Tool, Status: AssistantProposalStatus(p.Status), CreatedAt: p.CreatedAt, ExpiresAt: p.ExpiresAt,
		Suggested: p.Suggested, WaitingFor: p.WaitingFor(),
	}
	if p.Reason != "" {
		out.Reason = &p.Reason
	}

	if p.Summary != "" {
		out.Summary = &p.Summary
	}

	if out.WaitingFor == nil {
		out.WaitingFor = []uuid.UUID{}
	}

	if p.Expired(s.svc.Now()) {
		out.Status = AssistantProposalStatusExpired
	}

	if err := json.Unmarshal(p.Preview, &out.Preview); err != nil {
		return AssistantProposal{}, fmt.Errorf("decode preview of proposal %s: %w", p.ID, err)
	}

	if len(p.Result) > 0 {
		if err := json.Unmarshal(p.Result, &out.Result); err != nil {
			return AssistantProposal{}, fmt.Errorf("decode result of proposal %s: %w", p.ID, err)
		}
	}

	if !p.DecidedAt.IsZero() {
		out.DecidedAt = &p.DecidedAt
	}

	return out, nil
}

func (s *Server) confirmAssistantProposal(ctx context.Context, r *http.Request, _ httpserver.None) (AssistantProposal, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return AssistantProposal{}, err
	}

	p, err := s.svc.Confirm(ctx, auth.MustBooksID(ctx), auth.MustMemberID(ctx), id)
	if err != nil {
		return AssistantProposal{}, err
	}

	return s.toProposal(p)
}

func (s *Server) rejectAssistantProposal(ctx context.Context, r *http.Request, _ httpserver.None) (AssistantProposal, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return AssistantProposal{}, err
	}

	p, err := s.svc.Reject(ctx, auth.MustBooksID(ctx), auth.MustMemberID(ctx), id)
	if err != nil {
		return AssistantProposal{}, err
	}

	return s.toProposal(p)
}
