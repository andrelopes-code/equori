package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/app"
	"github.com/andrelopes-code/equori/internal/assistant/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

// toProposal converts a stored proposal; a pending or waiting proposal past its expiry reads as expired.
func (s *Server) toProposal(p domain.Proposal) (AssistantProposal, error) {
	out := AssistantProposal{
		Id:         p.ID,
		Tool:       p.Tool,
		Status:     AssistantProposalStatus(p.Status),
		CreatedAt:  p.CreatedAt,
		ExpiresAt:  p.ExpiresAt,
		Suggested:  p.Suggested,
		WaitingFor: p.WaitingFor(),
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

	s.setUndo(&out, p)

	return out, nil
}

// setUndo writes whether p can be undone and the undo it is or that undid it (V19).
func (s *Server) setUndo(out *AssistantProposal, p domain.Proposal) {
	undoable := s.svc.Undoable(p)
	out.Undoable = &undoable

	if p.Undoes != uuid.Nil {
		out.Undoes = &p.Undoes
	}

	if p.UndoneBy != uuid.Nil {
		out.UndoneBy = &p.UndoneBy
	}
}

func (s *Server) confirmAssistantProposal(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (AssistantProposal, error) {
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

func (s *Server) rejectAssistantProposal(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (AssistantProposal, error) {
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

func (s *Server) undoAssistantProposal(
	ctx context.Context,
	r *http.Request,
	in UndoAssistantProposalJSONRequestBody,
) (AssistantProposal, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return AssistantProposal{}, err
	}

	p, err := s.svc.Undo(ctx, auth.MustBooksID(ctx), auth.MustMemberID(ctx), id, in.Reason)
	if err != nil {
		return AssistantProposal{}, err
	}

	return s.toProposal(p)
}

// proposalProblem maps the errors of deciding and undoing a proposal (ADR 004).
func proposalProblem(err error) (problem.Details, bool) {
	switch {
	case errors.Is(err, domain.ErrProposalNotFound):
		return problem.New(http.StatusNotFound, "proposal_not_found", "proposal not found"), true
	case errors.Is(err, app.ErrProposalClosed):
		return problem.New(
			http.StatusConflict,
			"proposal_closed",
			"the proposal was already decided",
		), true
	case errors.Is(err, app.ErrProposalNotUndoable):
		return problem.New(http.StatusConflict, "proposal_not_undoable", err.Error()), true
	case errors.Is(err, app.ErrProposalUndone):
		return problem.New(http.StatusConflict, "proposal_undone", err.Error()), true
	case errors.Is(err, app.ErrInvalidUndoReason):
		d := problem.New(http.StatusBadRequest, "invalid_request", err.Error())
		d.Errors = []problem.FieldError{{Field: "reason", Message: err.Error()}}

		return d, true
	case errors.Is(err, app.ErrProposalExpired):
		return problem.New(
			http.StatusConflict,
			"proposal_expired",
			"the proposal expired; ask the assistant again",
		), true
	case errors.Is(err, app.ErrProposalWaiting):
		return problem.New(
			http.StatusConflict,
			"proposal_waiting",
			"the proposal waits for the confirmation of another proposal",
		), true
	case errors.Is(err, app.ErrProposalStale):
		return problem.New(
			http.StatusConflict,
			"proposal_stale",
			"the data changed after the proposal; ask the assistant again",
		), true
	}

	return problem.Details{}, false
}
