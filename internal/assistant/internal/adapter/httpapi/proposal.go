package httpapi

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

// toProposal converts a stored proposal; a pending proposal past its expiry reads as expired.
func (s *Server) toProposal(p domain.Proposal) (AssistantProposal, error) {
	out := AssistantProposal{Id: p.ID, Tool: p.Tool, Status: AssistantProposalStatus(p.Status), CreatedAt: p.CreatedAt, ExpiresAt: p.ExpiresAt}
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

func (s *Server) ConfirmAssistantProposal(ctx context.Context, req ConfirmAssistantProposalRequestObject) (ConfirmAssistantProposalResponseObject, error) {
	p, err := s.svc.Confirm(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	out, err := s.toProposal(p)
	return ConfirmAssistantProposal200JSONResponse(out), err
}

func (s *Server) RejectAssistantProposal(ctx context.Context, req RejectAssistantProposalRequestObject) (RejectAssistantProposalResponseObject, error) {
	p, err := s.svc.Reject(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	out, err := s.toProposal(p)
	return RejectAssistantProposal200JSONResponse(out), err
}
