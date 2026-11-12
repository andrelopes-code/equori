package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) listInvitations(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (InvitationList, error) {
	invitations, err := s.svc.Invitations(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return InvitationList{}, err
	}

	items := make([]Invitation, 0, len(invitations))
	for _, inv := range invitations {
		items = append(items, toAPIInvitation(inv))
	}

	return InvitationList{Items: items}, nil
}

func (s *Server) createInvitation(
	ctx context.Context,
	_ *http.Request,
	in CreateInvitationJSONRequestBody,
) (Invitation, error) {
	token, inv, err := s.svc.CreateInvitation(
		ctx,
		auth.MustBooksID(ctx),
		auth.MustMemberID(ctx),
		in.Email,
		auth.BookRole(in.Role),
	)
	if err != nil {
		return Invitation{}, err
	}

	out := toAPIInvitation(inv)
	out.Token = &token

	return out, nil
}

func (s *Server) createAccountInvitation(
	ctx context.Context,
	_ *http.Request,
	in CreateAccountInvitationJSONRequestBody,
) (AccountInvitation, error) {
	token, inv, err := s.svc.CreateAccountInvitation(
		ctx,
		auth.MustMemberID(ctx),
		in.Email,
		in.Region,
		money.Currency(deref(in.BaseCurrency)),
	)
	if err != nil {
		return AccountInvitation{}, err
	}

	return AccountInvitation{
		Email:        inv.Email,
		Region:       inv.Region,
		BaseCurrency: inv.BaseCurrency,
		ExpiresAt:    inv.ExpiresAt,
		Token:        token,
	}, nil
}

func (s *Server) deleteInvitation(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.DeleteInvitation(ctx, auth.MustBooksID(ctx), id); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func (s *Server) previewInvitation(
	ctx context.Context,
	_ *http.Request,
	in PreviewInvitationJSONRequestBody,
) (InvitationPreview, error) {
	p, err := s.svc.PreviewInvitation(ctx, in.Token)
	if err != nil {
		return InvitationPreview{}, err
	}

	return InvitationPreview{
		Kind:         InvitationPreviewKind(p.Kind),
		BooksName:    p.BooksName,
		InviterEmail: p.InviterEmail,
		Role:         BookRole(p.Role),
		Email:        p.Email,
		MemberExists: p.MemberExists,
	}, nil
}

// acceptInvitation answers 204, with the session cookie when the acceptance opens a session.
func (s *Server) acceptInvitation(w http.ResponseWriter, r *http.Request) {
	in, ok := decodeBody[AcceptInvitationJSONRequestBody](s, w, r)
	if !ok {
		return
	}

	a := app.Acceptance{Token: in.Token, Password: deref(in.Password), Language: deref(in.Language)}
	if c, err := r.Cookie(CookieName); err == nil {
		a.SessionToken = c.Value
	}

	session, err := s.svc.AcceptInvitation(r.Context(), a)
	if err != nil {
		s.errs.Write(w, r, err)
		return
	}

	if session.Token != "" {
		w.Header().Set("Set-Cookie", s.cookie(session.Token, session.ExpiresAt))
	}

	w.WriteHeader(http.StatusNoContent)
}

func toAPIInvitation(inv domain.Invitation) Invitation {
	return Invitation{
		Id:        inv.ID,
		Email:     inv.Email,
		Role:      BookRole(inv.Role),
		CreatedAt: inv.CreatedAt,
		ExpiresAt: inv.ExpiresAt,
	}
}
