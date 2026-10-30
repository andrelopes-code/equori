package auth_test

import (
	"context"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func TestIdentity(t *testing.T) {
	t.Parallel()

	bg := context.Background()

	for _, tt := range []struct {
		name      string
		ctx       context.Context
		memberID  int64
		hasMember bool
		booksID   int64
		hasBooks  bool
	}{
		{"identity", auth.WithIdentity(bg, 7, 9, auth.RoleOwner), 7, true, 9, true},
		{"books only", auth.WithBooksID(bg, 9), 0, false, 9, true},
		{"books replaced", auth.WithBooksID(auth.WithIdentity(bg, 7, 9, auth.RoleOwner), 11), 7, true, 11, true},
		{"empty", bg, 0, false, 0, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			memberID, hasMember := auth.MemberID(tt.ctx)
			if memberID != tt.memberID || hasMember != tt.hasMember {
				t.Errorf("MemberID = %d, %v; want %d, %v", memberID, hasMember, tt.memberID, tt.hasMember)
			}

			booksID, hasBooks := auth.BooksID(tt.ctx)
			if booksID != tt.booksID || hasBooks != tt.hasBooks {
				t.Errorf("BooksID = %d, %v; want %d, %v", booksID, hasBooks, tt.booksID, tt.hasBooks)
			}
		})
	}
}

func TestMustMemberIDPanics(t *testing.T) {
	t.Parallel()

	defer func() {
		if got := recover(); got != "auth: no authenticated member in context" {
			t.Errorf("panic = %v, want the member message", got)
		}
	}()

	auth.MustMemberID(auth.WithBooksID(context.Background(), 9))
}

func TestBookRoleAllows(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		role                     auth.BookRole
		read, write, owner, none bool
	}{
		{auth.RoleRead, true, false, false, false},
		{auth.RoleWrite, true, true, false, false},
		{auth.RoleOwner, true, true, true, false},
		{"", false, false, false, false},
		{"admin", false, false, false, false},
	} {
		t.Run(string(tt.role), func(t *testing.T) {
			t.Parallel()

			got := []bool{
				tt.role.Allows(auth.RoleRead),
				tt.role.Allows(auth.RoleWrite),
				tt.role.Allows(auth.RoleOwner),
				tt.role.Allows(""),
			}
			want := []bool{tt.read, tt.write, tt.owner, tt.none}

			if !slices.Equal(got, want) {
				t.Errorf("Allows(read, write, owner, empty) = %v, want %v", got, want)
			}
		})
	}
}

func TestMustBookRole(t *testing.T) {
	t.Parallel()

	ctx := auth.WithBooksID(auth.WithIdentity(context.Background(), 7, 9, auth.RoleWrite), 11)
	if got := auth.MustBookRole(ctx); got != auth.RoleWrite {
		t.Errorf("MustBookRole = %q, want %q", got, auth.RoleWrite)
	}
}
