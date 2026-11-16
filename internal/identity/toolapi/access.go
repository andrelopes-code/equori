package toolapi

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type getBookAccessIn struct{}

type bookAccessOut struct {
	Name        string                 `json:"name"`
	Region      string                 `json:"region"`
	TimeZone    string                 `json:"time_zone"`
	Members     []bookAccessMember     `json:"members"`
	Invitations []bookAccessInvitation `json:"invitations"`
}

type bookAccessMember struct {
	MemberID    int64  `json:"member_id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name,omitzero"`
	Role        string `json:"role"`
}

type bookAccessInvitation struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	ExpiresAt string `json:"expires_at"`
}

func getBookAccess(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_book_access",
		Description: "Reads the book's name, region and time zone, its members with their roles and its pending invitations, without the invitation token. " +
			"Use it when the owner asks who has access to the book or what its settings are, and before manage_book. " +
			"Do not use it for the member's own profile: update_profile does.",
		Effect:     tool.ReadOnly,
		Idempotent: true,
		Role:       auth.RoleOwner,
	}, func(ctx context.Context, booksID int64, _ getBookAccessIn) (bookAccessOut, error) {
		settings, err := svc.BooksSettings(ctx, booksID)
		if err != nil {
			return bookAccessOut{}, err
		}

		members, err := svc.Members(ctx, booksID)
		if err != nil {
			return bookAccessOut{}, err
		}

		invitations, err := svc.Invitations(ctx, booksID)
		if err != nil {
			return bookAccessOut{}, err
		}

		return newBookAccess(settings, members, invitations), nil
	})
}

func newBookAccess(
	settings app.BooksSettings,
	members []app.Membership,
	invitations []domain.Invitation,
) bookAccessOut {
	out := bookAccessOut{
		Name:        settings.Name,
		Region:      settings.Region,
		TimeZone:    effectiveTimeZone(settings),
		Members:     make([]bookAccessMember, 0, len(members)),
		Invitations: make([]bookAccessInvitation, 0, len(invitations)),
	}
	for _, m := range members {
		out.Members = append(out.Members, bookAccessMember{
			MemberID:    m.MemberID,
			Email:       m.Email,
			DisplayName: m.DisplayName,
			Role:        string(m.Role),
		})
	}

	for _, inv := range invitations {
		out.Invitations = append(out.Invitations, bookAccessInvitation{
			ID:        inv.ID.String(),
			Email:     inv.Email,
			Role:      inv.Role,
			ExpiresAt: inv.ExpiresAt.UTC().Format(time.RFC3339),
		})
	}

	return out
}

// effectiveTimeZone is the time zone of the book, or the default of its region while none is set.
func effectiveTimeZone(s app.BooksSettings) string {
	if s.TimeZone != nil {
		return *s.TimeZone
	}

	return s.DefaultTimeZone
}
