package httpapi

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) ListMembers(ctx context.Context, _ ListMembersRequestObject) (ListMembersResponseObject, error) {
	members, err := s.svc.Members(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return nil, err
	}

	items := make([]BooksMember, 0, len(members))
	for _, m := range members {
		items = append(items, toAPIBooksMember(m))
	}

	return ListMembers200JSONResponse{Items: items}, nil
}

func (s *Server) UpdateMember(ctx context.Context, req UpdateMemberRequestObject) (UpdateMemberResponseObject, error) {
	if req.Body == nil {
		return nil, errInvalidRequest
	}

	if err := s.svc.ChangeRole(ctx, auth.MustBooksID(ctx), req.MemberId, auth.BookRole(req.Body.Role)); err != nil {
		return nil, err
	}

	return UpdateMember204Response{}, nil
}

func (s *Server) RemoveMember(ctx context.Context, req RemoveMemberRequestObject) (RemoveMemberResponseObject, error) {
	if err := s.svc.RemoveMembership(ctx, auth.MustBooksID(ctx), req.MemberId); err != nil {
		return nil, err
	}

	return RemoveMember204Response{}, nil
}

// LeaveBooks ends the caller's session with the membership (BK6), so it answers the expired cookie.
func (s *Server) LeaveBooks(ctx context.Context, _ LeaveBooksRequestObject) (LeaveBooksResponseObject, error) {
	if err := s.svc.RemoveMembership(ctx, auth.MustBooksID(ctx), auth.MustMemberID(ctx)); err != nil {
		return nil, err
	}

	cookie := s.cookie("", time.Unix(0, 0))

	return LeaveBooks204Response{Headers: LeaveBooks204ResponseHeaders{SetCookie: &cookie}}, nil
}

// DeleteCurrentBooks ends the session of the caller with the book (DB6), so it answers the expired cookie.
func (s *Server) DeleteCurrentBooks(ctx context.Context, req DeleteCurrentBooksRequestObject) (DeleteCurrentBooksResponseObject, error) {
	if req.Body == nil {
		return nil, errInvalidRequest
	}

	if err := s.svc.DeleteBooks(ctx, auth.MustBooksID(ctx), auth.MustMemberID(ctx), req.Body.Name); err != nil {
		return nil, err
	}

	cookie := s.cookie("", time.Unix(0, 0))

	return DeleteCurrentBooks204Response{Headers: DeleteCurrentBooks204ResponseHeaders{SetCookie: &cookie}}, nil
}

func toAPIBooksMember(m app.Membership) BooksMember {
	return BooksMember{MemberId: m.MemberID, Email: m.Email, Role: BookRole(m.Role), CreatedAt: m.CreatedAt}
}
