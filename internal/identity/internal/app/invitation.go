package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/locale"
)

type InvitationPreview struct {
	BooksID      int64
	BooksName    string
	InviterEmail string
	Email        string
	Role         auth.BookRole
	MemberExists bool
}

type Acceptance struct {
	Token string
	// SessionToken is the caller's session cookie, "" without one.
	SessionToken       string
	Password, Language string
}

type InvitationRepository interface {
	// SaveInvitation deletes the book's expired invitations, then stores inv; ErrAlreadyMember when the
	// email has a membership in the book.
	SaveInvitation(ctx context.Context, inv domain.Invitation) (domain.Invitation, error)
	// Invitations deletes the book's expired invitations and returns the others.
	Invitations(ctx context.Context, booksID int64, now time.Time) ([]domain.Invitation, error)
	// DeleteInvitation returns ErrInvitationNotFound when the book has no invitation with id.
	DeleteInvitation(ctx context.Context, booksID int64, id uuid.UUID) error
	// InvitationPreview returns ErrInvitationNotFound for an unknown or expired token hash.
	InvitationPreview(ctx context.Context, tokenHash []byte, now time.Time) (InvitationPreview, error)
	// AcceptAsNewMember deletes the invitation and creates m with its membership in one transaction;
	// ErrInvitationNotFound, ErrEmailTaken.
	AcceptAsNewMember(ctx context.Context, tokenHash []byte, m domain.Member, now time.Time) (domain.Member, int64, error)
	// AcceptAsMember deletes the invitation, adds the membership and moves the session in one
	// transaction; ErrInvitationNotFound, ErrAlreadyMember.
	AcceptAsMember(ctx context.Context, tokenHash []byte, memberID int64, sessionHash []byte, now time.Time) error
}

// CreateInvitation returns the token, shown once, and the stored invitation (HA24): ErrAlreadyMember.
func (s *Service) CreateInvitation(ctx context.Context, booksID, invitedBy int64, email string, role auth.BookRole) (string, domain.Invitation, error) {
	email, err := domain.NormalizeEmail(email)
	if err != nil {
		return "", domain.Invitation{}, &domain.FieldError{Field: "email", Message: "must be an email address"}
	}

	token, inv := domain.NewInvitation(booksID, invitedBy, email, string(role), s.now())

	stored, err := s.repo.SaveInvitation(ctx, inv)
	if err != nil {
		return "", domain.Invitation{}, err
	}

	return token, stored, nil
}

// Invitations lists the pending invitations of the book, newest first (HA24).
func (s *Service) Invitations(ctx context.Context, booksID int64) ([]domain.Invitation, error) {
	return s.repo.Invitations(ctx, booksID, s.now())
}

// DeleteInvitation revokes a pending invitation: ErrInvitationNotFound.
func (s *Service) DeleteInvitation(ctx context.Context, booksID int64, id uuid.UUID) error {
	return s.repo.DeleteInvitation(ctx, booksID, id)
}

// PreviewInvitation describes the invitation of a token (HA25): ErrInvitationNotFound.
func (s *Service) PreviewInvitation(ctx context.Context, token string) (InvitationPreview, error) {
	return s.repo.InvitationPreview(ctx, domain.HashToken(token), s.now())
}

// AcceptInvitation returns the session of a new member, or a zero Session when the caller's session moved to the book (HA26).
func (s *Service) AcceptInvitation(ctx context.Context, a Acceptance) (Session, error) {
	now := s.now()
	tokenHash := domain.HashToken(a.Token)

	preview, err := s.repo.InvitationPreview(ctx, tokenHash, now)
	if err != nil {
		return Session{}, err
	}

	if preview.MemberExists {
		return Session{}, s.acceptAsMember(ctx, tokenHash, preview, a.SessionToken, now)
	}

	return s.acceptAsNewMember(ctx, tokenHash, preview, a, now)
}

func (s *Service) acceptAsMember(ctx context.Context, tokenHash []byte, preview InvitationPreview, sessionToken string, now time.Time) error {
	if sessionToken == "" {
		return ErrUnauthenticated
	}

	access, err := s.Authenticate(ctx, sessionToken)
	if err != nil {
		return ErrUnauthenticated
	}

	if access.Member.Email != preview.Email {
		return ErrInvitationEmailMismatch
	}

	return s.repo.AcceptAsMember(ctx, tokenHash, access.Member.ID, domain.HashToken(sessionToken), now)
}

func (s *Service) acceptAsNewMember(ctx context.Context, tokenHash []byte, preview InvitationPreview, a Acceptance, now time.Time) (Session, error) {
	if err := validateAcceptance(a); err != nil {
		return Session{}, err
	}

	m, err := s.newMember(ctx, preview.Email, a.Password, domain.RoleMember, a.Language)
	if err != nil {
		return Session{}, err
	}

	member, booksID, err := s.repo.AcceptAsNewMember(ctx, tokenHash, m, now)
	if errors.Is(err, ErrEmailTaken) {
		return Session{}, ErrUnauthenticated
	}

	if err != nil {
		return Session{}, fmt.Errorf("accept invitation as new member: %w", err)
	}

	return s.startSession(ctx, member.ID, booksID, now)
}

func validateAcceptance(a Acceptance) error {
	if a.Password == "" {
		return &domain.FieldError{Field: "password", Message: "is required"}
	}

	if err := domain.ValidatePassword(a.Password); err != nil {
		return &domain.FieldError{Field: "password", Message: err.Error()}
	}

	if a.Language == "" {
		return &domain.FieldError{Field: "language", Message: "is required"}
	}

	if !locale.ValidLanguage(a.Language) {
		return &domain.FieldError{Field: "language", Message: "must be an ISO 639 language code"}
	}

	return nil
}
