package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/andrelopes-code/equori/internal/assistant/app"
	"github.com/andrelopes-code/equori/internal/assistant/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toConversation(c domain.Conversation) AssistantConversation {
	return AssistantConversation{
		Id:        c.ID,
		Title:     c.Title,
		CreatedAt: c.CreatedAt,
		UpdatedAt: c.UpdatedAt,
	}
}

func (s *Server) toMessage(
	m domain.Message,
	proposals []domain.Proposal,
) (AssistantMessage, error) {
	out := AssistantMessage{
		Id:        m.ID,
		Role:      AssistantMessageRole(m.Role),
		Content:   m.Content,
		CreatedAt: m.CreatedAt,
		Proposals: []AssistantProposal{},
		Files:     make([]AssistantFile, len(m.Files)),
		Views:     make([]AssistantView, len(m.Views)),
	}
	for i, f := range m.Files {
		out.Files[i] = toFileAPI(f)
	}

	for i, v := range m.Views {
		var payload AssistantViewPayload
		if err := json.Unmarshal(v.Payload, &payload); err != nil {
			return AssistantMessage{}, fmt.Errorf("decode view %s: %w", v.ID, err)
		}

		out.Views[i] = AssistantView{Id: v.ID, Form: v.Form, Payload: payload}
	}

	if m.Outcome != domain.OutcomeNone {
		o := AssistantMessageOutcome(m.Outcome)
		out.Outcome = &o
	}

	for _, p := range proposals {
		if p.MessageID != m.ID {
			continue
		}

		v, err := s.toProposal(p)
		if err != nil {
			return AssistantMessage{}, err
		}

		out.Proposals = append(out.Proposals, v)
	}

	return out, nil
}

func (s *Server) listAssistantConversations(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (AssistantConversationPage, error) {
	params, err := httpserver.Query[ListAssistantConversationsParams](r)
	if err != nil {
		return AssistantConversationPage{}, err
	}

	pr, err := page.Read[app.ConversationKey](params.Limit, params.Cursor)
	switch {
	case errors.Is(err, page.ErrInvalidLimit):
		return AssistantConversationPage{}, &domain.FieldError{
			Field:   "limit",
			Message: "must be between 1 and 200",
		}
	case errors.Is(err, page.ErrInvalidCursor):
		return AssistantConversationPage{}, &domain.FieldError{
			Field:   "cursor",
			Message: "is not a cursor of this list",
		}
	case err != nil:
		return AssistantConversationPage{}, err
	}

	rows, next, err := s.svc.ConversationPage(
		ctx,
		auth.MustBooksID(ctx),
		auth.MustMemberID(ctx),
		pr.After,
		pr.Limit,
	)
	if err != nil {
		return AssistantConversationPage{}, err
	}

	out := AssistantConversationPage{Items: make([]AssistantConversation, len(rows))}
	for i, c := range rows {
		out.Items[i] = toConversation(c)
	}

	if out.NextCursor, err = page.Next(next); err != nil {
		return AssistantConversationPage{}, err
	}

	return out, nil
}

func (s *Server) getAssistantConversation(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (AssistantConversationDetail, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return AssistantConversationDetail{}, err
	}

	d, err := s.svc.Conversation(ctx, auth.MustBooksID(ctx), auth.MustMemberID(ctx), id)
	if err != nil {
		return AssistantConversationDetail{}, err
	}

	c := d.Conversation

	out := AssistantConversationDetail{
		Id:        c.ID,
		Title:     c.Title,
		CreatedAt: c.CreatedAt,
		UpdatedAt: c.UpdatedAt,
		Messages:  make([]AssistantMessage, len(d.Messages)),
	}
	for i, m := range d.Messages {
		if out.Messages[i], err = s.toMessage(m, d.Proposals); err != nil {
			return AssistantConversationDetail{}, err
		}
	}

	return out, nil
}

func (s *Server) deleteAssistantConversation(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.DeleteConversation(
		ctx,
		auth.MustBooksID(ctx),
		auth.MustMemberID(ctx),
		id,
	); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func (s *Server) deleteAssistantConversations(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	if err := s.svc.DeleteConversations(
		ctx,
		auth.MustBooksID(ctx),
		auth.MustMemberID(ctx),
	); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}
