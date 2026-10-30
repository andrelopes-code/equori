// Package auth carries the authenticated member and the active book through the request context (ADR 029).
// The identity module sets them; every other module reads them.
package auth

import "context"

type identityKey struct{}

type identity struct {
	memberID  int64
	booksID   int64
	hasMember bool
}

func WithIdentity(ctx context.Context, memberID, booksID int64) context.Context {
	return context.WithValue(ctx, identityKey{}, identity{memberID: memberID, booksID: booksID, hasMember: true})
}

func MemberID(ctx context.Context) (int64, bool) {
	id, ok := ctx.Value(identityKey{}).(identity)
	if !ok || !id.hasMember {
		return 0, false
	}

	return id.memberID, true
}

func BooksID(ctx context.Context) (int64, bool) {
	id, ok := ctx.Value(identityKey{}).(identity)
	return id.booksID, ok
}

// MustMemberID panics when ctx has no member. Handlers under /api/v1 may call it:
// identity.Module.RequireSession rejects unauthenticated requests before they reach them.
func MustMemberID(ctx context.Context) int64 {
	id, ok := MemberID(ctx)
	if !ok {
		panic("auth: no authenticated member in context")
	}

	return id
}

// MustBooksID panics when ctx has no active books; see MustMemberID.
func MustBooksID(ctx context.Context) int64 {
	id, ok := BooksID(ctx)
	if !ok {
		panic("auth: no active books in context")
	}

	return id
}

// WithBooksID returns ctx with booksID as the active book and the member already in ctx, if any.
func WithBooksID(ctx context.Context, booksID int64) context.Context {
	id, _ := ctx.Value(identityKey{}).(identity)
	id.booksID = booksID

	return context.WithValue(ctx, identityKey{}, id)
}
