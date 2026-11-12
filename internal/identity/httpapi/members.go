package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) listMembers(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (BooksMemberList, error) {
	members, err := s.svc.Members(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return BooksMemberList{}, err
	}

	items := make([]BooksMember, 0, len(members))
	for _, m := range members {
		items = append(items, toAPIBooksMember(m))
	}

	return BooksMemberList{Items: items}, nil
}

func (s *Server) updateMember(
	ctx context.Context,
	r *http.Request,
	in UpdateMemberJSONRequestBody,
) (httpserver.None, error) {
	memberID, err := httpserver.PathInt64(r, "memberId")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.ChangeRole(
		ctx,
		auth.MustBooksID(ctx),
		memberID,
		auth.BookRole(in.Role),
	); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func (s *Server) removeMember(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	memberID, err := httpserver.PathInt64(r, "memberId")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.RemoveMembership(ctx, auth.MustBooksID(ctx), memberID); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

// leaveBooks ends the caller's session with the membership (BK6), so it answers the expired cookie.
func (s *Server) leaveBooks(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if err := s.svc.RemoveMembership(
		ctx,
		auth.MustBooksID(ctx),
		auth.MustMemberID(ctx),
	); err != nil {
		s.errs.Write(w, r, err)
		return
	}

	w.Header().Set("Set-Cookie", s.cookie("", time.Unix(0, 0)))
	w.WriteHeader(http.StatusNoContent)
}

// deleteCurrentBooks ends the session of the caller with the book (DB6), so it answers the expired cookie.
func (s *Server) deleteCurrentBooks(w http.ResponseWriter, r *http.Request) {
	in, ok := decodeBody[DeleteCurrentBooksJSONRequestBody](s, w, r)
	if !ok {
		return
	}

	ctx := r.Context()

	if err := s.svc.DeleteBooks(
		ctx,
		auth.MustBooksID(ctx),
		auth.MustMemberID(ctx),
		in.Name,
	); err != nil {
		s.errs.Write(w, r, err)
		return
	}

	w.Header().Set("Set-Cookie", s.cookie("", time.Unix(0, 0)))
	w.WriteHeader(http.StatusNoContent)
}

func toAPIBooksMember(m app.Membership) BooksMember {
	return BooksMember{
		MemberId:    m.MemberID,
		Email:       m.Email,
		DisplayName: optional(m.DisplayName),
		Role:        BookRole(m.Role),
		CreatedAt:   m.CreatedAt,
	}
}
