// Package auth carries the authenticated user ID through the request context.
// The identity module sets it; every other module reads it.
package auth

import "context"

type userIDKey struct{}

func WithUserID(ctx context.Context, id int64) context.Context {
	return context.WithValue(ctx, userIDKey{}, id)
}

func UserID(ctx context.Context) (int64, bool) {
	id, ok := ctx.Value(userIDKey{}).(int64)
	return id, ok
}

// MustUserID panics when ctx has no user. Handlers under /api/v1 may call it:
// identity.Module.RequireSession rejects unauthenticated requests before they reach them.
func MustUserID(ctx context.Context) int64 {
	id, ok := UserID(ctx)
	if !ok {
		panic("auth: no authenticated user in context")
	}
	return id
}
