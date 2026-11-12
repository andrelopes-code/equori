// Package app implements the identity use cases.
package app

import (
	"context"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type BooksMembership struct {
	ID     int64
	Name   string
	Role   auth.BookRole
	Active bool
}

type Membership struct {
	MemberID    int64
	Email       string
	DisplayName string
	Role        auth.BookRole
	CreatedAt   time.Time
}

// Books lists the books of the member's memberships, by ID; Active marks activeBooksID (HA5).
func (s *Service) Books(
	ctx context.Context,
	memberID, activeBooksID int64,
) ([]BooksMembership, error) {
	books, err := s.repo.MemberBooks(ctx, memberID)
	if err != nil {
		return nil, fmt.Errorf("list books of member %d: %w", memberID, err)
	}

	for i := range books {
		books[i].Active = books[i].ID == activeBooksID
	}

	return books, nil
}

// SwitchBooks moves the session to booksID: ErrBooksNotFound without a membership of the member (HA4).
func (s *Service) SwitchBooks(
	ctx context.Context,
	memberID int64,
	sessionToken string,
	booksID int64,
) error {
	return s.repo.SwitchSession(ctx, domain.HashToken(sessionToken), memberID, booksID, s.now())
}

// CreateBooks creates a book with the member as owner; a nil name takes the member's email and an
// empty base takes the default of the region (HA6).
func (s *Service) CreateBooks(
	ctx context.Context,
	memberID int64,
	name *string,
	region string,
	base money.Currency,
) (BooksMembership, error) {
	base, err := s.baseCurrency(region, base)
	if err != nil {
		return BooksMembership{}, err
	}

	if err := validateBooks(region, base); err != nil {
		return BooksMembership{}, err
	}

	member, err := s.repo.MemberByID(ctx, memberID)
	if err != nil {
		return BooksMembership{}, fmt.Errorf("load member %d: %w", memberID, err)
	}

	booksName := domain.DefaultBooksName(member.Email)
	if name != nil {
		booksName = *name
	}

	id, err := s.repo.CreateBooks(ctx, memberID, member.Language, booksName, region, base)
	if err != nil {
		return BooksMembership{}, fmt.Errorf("create books of member %d: %w", memberID, err)
	}

	return BooksMembership{ID: id, Name: booksName, Role: auth.RoleOwner}, nil
}

// Members lists the memberships of the book, oldest first (HA19).
func (s *Service) Members(ctx context.Context, booksID int64) ([]Membership, error) {
	return s.repo.Members(ctx, booksID)
}

// ChangeRole sets the role of a membership: ErrMemberNotFound, ErrLastOwner (HA20, HA21).
func (s *Service) ChangeRole(
	ctx context.Context,
	booksID, memberID int64,
	role auth.BookRole,
) error {
	return s.repo.ChangeRole(ctx, booksID, memberID, role)
}

// RemoveMembership deletes a membership with its sessions and tokens: ErrMemberNotFound, ErrLastOwner (HA20, HA22).
func (s *Service) RemoveMembership(ctx context.Context, booksID, memberID int64) error {
	return s.repo.RemoveMembership(ctx, booksID, memberID)
}

// DeleteBooks deletes the book of the caller after the typed name matches (DB1 to DB6).
func (s *Service) DeleteBooks(ctx context.Context, booksID, memberID int64, name string) error {
	return s.repo.DeleteBooks(ctx, booksID, memberID, name)
}
