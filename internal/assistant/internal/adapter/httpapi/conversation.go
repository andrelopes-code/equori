package httpapi

import (
	"context"
	"errors"

	"github.com/andrelopes-code/equori/internal/assistant/internal/app"
	"github.com/andrelopes-code/equori/internal/assistant/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toConversation(c domain.Conversation) AssistantConversation {
	return AssistantConversation{Id: c.ID, Title: c.Title, CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt}
}

func (s *Server) toMessage(m domain.Message, proposals []domain.Proposal) (AssistantMessage, error) {
	out := AssistantMessage{
		Id: m.ID, Role: AssistantMessageRole(m.Role), Content: m.Content, CreatedAt: m.CreatedAt, Proposals: []AssistantProposal{},
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

func (s *Server) ListAssistantConversations(ctx context.Context, req ListAssistantConversationsRequestObject) (ListAssistantConversationsResponseObject, error) {
	r, err := page.Read[app.ConversationKey](req.Params.Limit, req.Params.Cursor)
	switch {
	case errors.Is(err, page.ErrInvalidLimit):
		return nil, &domain.FieldError{Field: "limit", Message: "must be between 1 and 200"}
	case errors.Is(err, page.ErrInvalidCursor):
		return nil, &domain.FieldError{Field: "cursor", Message: "is not a cursor of this list"}
	case err != nil:
		return nil, err
	}
	rows, next, err := s.svc.ConversationPage(ctx, auth.MustUserID(ctx), r.After, r.Limit)
	if err != nil {
		return nil, err
	}
	out := AssistantConversationPage{Items: make([]AssistantConversation, len(rows))}
	for i, c := range rows {
		out.Items[i] = toConversation(c)
	}
	if out.NextCursor, err = page.Next(next); err != nil {
		return nil, err
	}
	return ListAssistantConversations200JSONResponse(out), nil
}

func (s *Server) GetAssistantConversation(ctx context.Context, req GetAssistantConversationRequestObject) (GetAssistantConversationResponseObject, error) {
	d, err := s.svc.Conversation(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	c := d.Conversation
	out := AssistantConversationDetail{Id: c.ID, Title: c.Title, CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt, Messages: make([]AssistantMessage, len(d.Messages))}
	for i, m := range d.Messages {
		if out.Messages[i], err = s.toMessage(m, d.Proposals); err != nil {
			return nil, err
		}
	}
	return GetAssistantConversation200JSONResponse(out), nil
}

func (s *Server) DeleteAssistantConversation(ctx context.Context, req DeleteAssistantConversationRequestObject) (DeleteAssistantConversationResponseObject, error) {
	if err := s.svc.DeleteConversation(ctx, auth.MustUserID(ctx), req.Id); err != nil {
		return nil, err
	}
	return DeleteAssistantConversation204Response{}, nil
}

func (s *Server) DeleteAssistantConversations(ctx context.Context, _ DeleteAssistantConversationsRequestObject) (DeleteAssistantConversationsResponseObject, error) {
	if err := s.svc.DeleteConversations(ctx, auth.MustUserID(ctx)); err != nil {
		return nil, err
	}
	return DeleteAssistantConversations204Response{}, nil
}
