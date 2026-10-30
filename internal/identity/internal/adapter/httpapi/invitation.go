package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) ListInvitations(ctx context.Context, _ ListInvitationsRequestObject) (ListInvitationsResponseObject, error) {
	invitations, err := s.svc.Invitations(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return nil, err
	}

	items := make([]Invitation, 0, len(invitations))
	for _, inv := range invitations {
		items = append(items, toAPIInvitation(inv))
	}

	return ListInvitations200JSONResponse{Items: items}, nil
}

func (s *Server) CreateInvitation(ctx context.Context, req CreateInvitationRequestObject) (CreateInvitationResponseObject, error) {
	if req.Body == nil {
		return nil, errInvalidRequest
	}

	token, inv, err := s.svc.CreateInvitation(ctx, auth.MustBooksID(ctx), auth.MustMemberID(ctx), req.Body.Email, auth.BookRole(req.Body.Role))
	if err != nil {
		return nil, err
	}

	out := toAPIInvitation(inv)
	out.Token = &token

	return CreateInvitation201JSONResponse(out), nil
}

func (s *Server) DeleteInvitation(ctx context.Context, req DeleteInvitationRequestObject) (DeleteInvitationResponseObject, error) {
	if err := s.svc.DeleteInvitation(ctx, auth.MustBooksID(ctx), req.Id); err != nil {
		return nil, err
	}

	return DeleteInvitation204Response{}, nil
}

func (s *Server) PreviewInvitation(ctx context.Context, req PreviewInvitationRequestObject) (PreviewInvitationResponseObject, error) {
	if req.Body == nil {
		return nil, errInvalidRequest
	}

	p, err := s.svc.PreviewInvitation(ctx, req.Body.Token)
	if err != nil {
		return nil, err
	}

	return PreviewInvitation200JSONResponse{
		BooksName:    p.BooksName,
		InviterEmail: p.InviterEmail,
		Role:         BookRole(p.Role),
		Email:        p.Email,
		MemberExists: p.MemberExists,
	}, nil
}

func (s *Server) AcceptInvitation(ctx context.Context, req AcceptInvitationRequestObject) (AcceptInvitationResponseObject, error) {
	if req.Body == nil {
		return nil, errInvalidRequest
	}

	a := app.Acceptance{Token: req.Body.Token, Password: deref(req.Body.Password), Language: deref(req.Body.Language)}
	if req.Params.EquoriSession != nil {
		a.SessionToken = *req.Params.EquoriSession
	}

	session, err := s.svc.AcceptInvitation(ctx, a)
	if err != nil {
		return nil, err
	}

	if session.Token == "" {
		return AcceptInvitation204Response{}, nil
	}

	cookie := s.cookie(session.Token, session.ExpiresAt)

	return AcceptInvitation204Response{Headers: AcceptInvitation204ResponseHeaders{SetCookie: &cookie}}, nil
}

func toAPIInvitation(inv domain.Invitation) Invitation {
	return Invitation{Id: inv.ID, Email: inv.Email, Role: BookRole(inv.Role), CreatedAt: inv.CreatedAt, ExpiresAt: inv.ExpiresAt}
}
