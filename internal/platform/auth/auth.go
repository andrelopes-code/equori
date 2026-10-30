// Package auth carries the authenticated member and the active book through the request context (ADR 029).
// The identity module sets them; every other module reads them.
package auth

import "context"

type identityKey struct{}

// BookRole is the role of the member in the active book (ADR 029, HA15).
type BookRole string

const (
	RoleRead  BookRole = "read"
	RoleWrite BookRole = "write"
	RoleOwner BookRole = "owner"
)

type identity struct {
	memberID  int64
	booksID   int64
	role      BookRole
	hasMember bool
}

// Allows reports whether r ranks at or above required (read < write < owner); an unknown role
// on either side allows nothing.
func (r BookRole) Allows(required BookRole) bool {
	return r.rank() > 0 && required.rank() > 0 && r.rank() >= required.rank()
}

func (r BookRole) rank() int {
	switch r {
	case RoleRead:
		return 1
	case RoleWrite:
		return 2
	case RoleOwner:
		return 3
	}

	return 0
}

func WithIdentity(ctx context.Context, memberID, booksID int64, role BookRole) context.Context {
	return context.WithValue(ctx, identityKey{}, identity{memberID: memberID, booksID: booksID, role: role, hasMember: true})
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

// CurrentRole returns the book role of the context's member.
func CurrentRole(ctx context.Context) (BookRole, bool) {
	id, ok := ctx.Value(identityKey{}).(identity)
	if !ok || !id.hasMember {
		return "", false
	}

	return id.role, true
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

// MustBookRole panics when ctx has no member; see MustMemberID.
func MustBookRole(ctx context.Context) BookRole {
	role, ok := CurrentRole(ctx)
	if !ok {
		panic("auth: no authenticated member in context")
	}

	return role
}

// WithBooksID returns ctx with booksID as the active book and the member already in ctx, if any.
func WithBooksID(ctx context.Context, booksID int64) context.Context {
	id, _ := ctx.Value(identityKey{}).(identity)
	id.booksID = booksID

	return context.WithValue(ctx, identityKey{}, id)
}
