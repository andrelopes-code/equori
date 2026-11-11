// Package app implements the identity use cases.
package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/identity/password"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

type Session struct {
	MemberID  int64
	BooksID   int64
	Token     string
	ExpiresAt time.Time
}

// Access is an authenticated member in its active book.
type Access struct {
	Member  domain.Member
	BooksID int64
	Role    auth.BookRole
}

// Login counts every attempt against the email. A right password without a second factor clears
// the count and returns a session. With a second factor it returns a pending login and keeps the
// count until the second factor is right (HA46, HA47).
func (s *Service) Login(ctx context.Context, email, plain, origin string) (Session, *PendingLogin, error) {
	now := s.now()
	email, emailErr := domain.NormalizeEmail(email)
	// Byte bound equivalent to MaxPasswordLength runes (at most 4 bytes each); rejects before hashing.
	if emailErr != nil || len(plain) > 4*domain.MaxPasswordLength {
		return Session{}, nil, ErrInvalidCredentials
	}

	if !s.throttle.attempt(email, now) {
		return Session{}, nil, ErrTooManyAttempts
	}

	user, err := s.repo.MemberByEmail(ctx, email)
	switch {
	case errors.Is(err, ErrNotFound):
		if _, err := s.verify(ctx, plain, s.dummyHash); err != nil {
			return Session{}, nil, err
		}

		return Session{}, nil, ErrInvalidCredentials
	case err != nil:
		return Session{}, nil, fmt.Errorf("load member: %w", err)
	}

	ok, err := s.verify(ctx, plain, user.PasswordHash)
	if err != nil {
		return Session{}, nil, fmt.Errorf("verify password of member %d: %w", user.ID, err)
	}

	if !ok || user.Disabled {
		return Session{}, nil, ErrInvalidCredentials
	}

	factor, err := s.repo.HasSecondFactor(ctx, user.ID)
	if err != nil {
		return Session{}, nil, fmt.Errorf("check second factor of member %d: %w", user.ID, err)
	}

	if factor {
		pending, err := s.startPendingLogin(ctx, user.ID, origin, now)

		return Session{}, pending, err
	}

	s.throttle.reset(email)

	if err := s.repo.DeleteExpiredSessions(ctx, now); err != nil {
		return Session{}, nil, fmt.Errorf("delete expired sessions: %w", err)
	}

	booksID, err := s.repo.LoginBooks(ctx, user.ID)
	if errors.Is(err, ErrNotFound) {
		return Session{}, nil, ErrInvalidCredentials
	}

	if err != nil {
		return Session{}, nil, fmt.Errorf("load login books of member %d: %w", user.ID, err)
	}

	session, err := s.finishLogin(ctx, user.ID, booksID, now)

	return session, nil, err
}

// finishLogin books the login in the membership and starts the session.
func (s *Service) finishLogin(ctx context.Context, memberID, booksID int64, now time.Time) (Session, error) {
	if err := s.repo.TouchMembership(ctx, memberID, booksID, now); err != nil {
		return Session{}, fmt.Errorf("touch membership of member %d in books %d: %w", memberID, booksID, err)
	}

	return s.startSession(ctx, memberID, booksID, now)
}

func (s *Service) startSession(ctx context.Context, memberID, booksID int64, now time.Time) (Session, error) {
	token, session := domain.NewSession(memberID, booksID, now)
	if err := s.repo.CreateSession(ctx, session); err != nil {
		return Session{}, fmt.Errorf("create session: %w", err)
	}

	return Session{MemberID: memberID, BooksID: booksID, Token: token, ExpiresAt: session.ExpiresAt}, nil
}

func (s *Service) Logout(ctx context.Context, token string) error {
	return s.repo.DeleteSession(ctx, domain.HashToken(token))
}

// Authenticate returns the member, the active books ID and the role in it; ErrUnauthenticated for unknown or expired tokens and disabled members.
func (s *Service) Authenticate(ctx context.Context, token string) (Access, error) {
	access, err := s.repo.MemberBySession(ctx, domain.HashToken(token), s.now())
	switch {
	case errors.Is(err, ErrNotFound):
		return Access{}, ErrUnauthenticated
	case err != nil:
		return Access{}, fmt.Errorf("load session: %w", err)
	case access.Member.Disabled:
		return Access{}, ErrUnauthenticated
	}

	return access, nil
}

func (s *Service) verify(ctx context.Context, plain, hash string) (bool, error) {
	release, err := s.acquireHashSlot(ctx)
	if err != nil {
		return false, err
	}
	defer release()

	return password.Verify(plain, hash)
}

func (s *Service) acquireHashSlot(ctx context.Context) (release func(), err error) {
	ctx, cancel := context.WithTimeout(ctx, hashSlotWait)
	defer cancel()

	select {
	case s.hashSlots <- struct{}{}:
		return func() { <-s.hashSlots }, nil
	case <-ctx.Done():
		return nil, ErrBusy
	}
}
