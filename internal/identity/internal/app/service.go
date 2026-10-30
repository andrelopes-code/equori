// Package app implements the identity use cases.
package app

import (
	"context"
	"errors"
	"fmt"
	"runtime"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/identity/internal/password"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

var (
	ErrNotFound           = errors.New("not found")
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrTooManyAttempts    = errors.New("too many login attempts")
	ErrUnauthenticated    = errors.New("unauthenticated")
	ErrBusy               = errors.New("too many concurrent password operations")
	ErrTimeZoneInvalid    = errors.New("time zone is not an IANA name")
	// ErrAppearanceTooLarge reports an appearance object over MaxAppearanceBytes.
	ErrAppearanceTooLarge = errors.New("appearance over 16 KiB")
)

// Repository returns ErrNotFound for missing rows and ErrEmailTaken on duplicate email.
type Repository interface {
	CreateMember(ctx context.Context, u domain.Member, region string, base money.Currency) (domain.Member, int64, error)
	// CreateFirstMember returns ErrSetupComplete when a member exists.
	CreateFirstMember(ctx context.Context, u domain.Member, region string, base money.Currency) (domain.Member, int64, error)
	AnyMember(ctx context.Context) (bool, error)
	// UpdateProfile stores the language of the member and the region of the books in one transaction.
	UpdateProfile(ctx context.Context, memberID, booksID int64, l locale.Locale) error
	// Locale returns ErrNotFound without rows.
	Locale(ctx context.Context, booksID, memberID int64) (locale.Locale, error)
	// LoginBooks returns ErrNotFound without rows.
	LoginBooks(ctx context.Context, memberID int64) (int64, error)
	// BooksZone returns ErrNotFound without the row; timeZone is nil while the book uses the default of its region.
	BooksZone(ctx context.Context, booksID int64) (region string, timeZone *string, err error)
	// UpdateBooksSettings stores the region and the time_zone of the books.
	UpdateBooksSettings(ctx context.Context, booksID int64, region string, timeZone *string) error
	// Appearance returns the stored JSON object of the member.
	Appearance(ctx context.Context, memberID int64) ([]byte, error)
	// SetAppearance replaces the stored JSON object of the member.
	SetAppearance(ctx context.Context, memberID int64, doc []byte) error
	MemberByID(ctx context.Context, memberID int64) (domain.Member, error)
	MemberByEmail(ctx context.Context, email string) (domain.Member, error)
	CreateSession(ctx context.Context, s domain.Session) error
	MemberBySession(ctx context.Context, tokenHash []byte, now time.Time) (domain.Member, int64, error)
	DeleteSession(ctx context.Context, tokenHash []byte) error
	DeleteExpiredSessions(ctx context.Context, now time.Time) error
	AccessTokenRepository
}

// MaxAppearanceBytes bounds the encoded appearance object (BK21).
const MaxAppearanceBytes = 16 << 10

const (
	loginAttemptLimit  = 5
	loginAttemptWindow = 15 * time.Minute
	// hashSlotWait bounds how long a request queues for a password slot before ErrBusy.
	hashSlotWait = 5 * time.Second
)

type Service struct {
	repo            Repository
	now             func() time.Time
	defaultTimeZone func(region string) string
	throttle        *throttle
	// hashSlots caps concurrent argon2id runs; each one allocates 19 MiB.
	hashSlots chan struct{}
	// dummyHash is verified when the email is unknown, so both failure paths cost one argon2id run.
	dummyHash string
	setup     setup
}

func NewService(repo Repository, now func() time.Time, defaultTimeZone func(region string) string) *Service {
	return &Service{
		repo:            repo,
		now:             now,
		defaultTimeZone: defaultTimeZone,
		throttle:        newThrottle(loginAttemptLimit, loginAttemptWindow),
		hashSlots:       make(chan struct{}, runtime.NumCPU()),
		dummyHash:       password.Hash("dummy password for timing equalization"),
	}
}

func (s *Service) CreateMember(ctx context.Context, email, plain string, role domain.Role, l locale.Locale, base money.Currency) (domain.Member, error) {
	u, err := s.newMember(ctx, email, plain, role, l, base)
	if err != nil {
		return domain.Member{}, err
	}

	created, _, err := s.repo.CreateMember(ctx, u, l.Region, base)

	return created, err
}

// newMember validates a new member and hashes its password.
func (s *Service) newMember(ctx context.Context, email, plain string, role domain.Role, l locale.Locale, base money.Currency) (domain.Member, error) {
	email, err := domain.NormalizeEmail(email)
	if err != nil {
		return domain.Member{}, err
	}

	if err := domain.ValidatePassword(plain); err != nil {
		return domain.Member{}, err
	}

	if !role.Valid() {
		return domain.Member{}, domain.ErrInvalidRole
	}

	if err := validateLocale(l); err != nil {
		return domain.Member{}, err
	}

	if _, err := money.ParseCurrency(string(base)); err != nil {
		return domain.Member{}, &domain.FieldError{Field: "base_currency", Message: "must be an ISO 4217 currency code"}
	}

	release, err := s.acquireHashSlot(ctx)
	if err != nil {
		return domain.Member{}, err
	}

	hash := password.Hash(plain)

	release()

	return domain.Member{Email: email, PasswordHash: hash, Role: role, Language: l.Language}, nil
}

func validateLocale(l locale.Locale) error {
	if !locale.ValidLanguage(l.Language) {
		return &domain.FieldError{Field: "language", Message: "must be an ISO 639 language code"}
	}

	if !locale.ValidRegion(l.Region) {
		return &domain.FieldError{Field: "region", Message: "must be an ISO 3166-1 alpha-2 code"}
	}

	return nil
}

// Location returns the book's time_zone, or the default of its region while null.
func (s *Service) Location(ctx context.Context, booksID int64) (*time.Location, error) {
	region, timeZone, err := s.repo.BooksZone(ctx, booksID)
	if err != nil {
		return nil, fmt.Errorf("load time zone of books %d: %w", booksID, err)
	}

	name := s.defaultTimeZone(region)
	if timeZone != nil {
		name = *timeZone
	}

	loc, err := time.LoadLocation(name)
	if err != nil {
		return nil, fmt.Errorf("load location of books %d: %w", booksID, err)
	}

	return loc, nil
}

// Profile returns the language and region of the books for the member (BK27).
func (s *Service) Profile(ctx context.Context, booksID, memberID int64) (locale.Locale, error) {
	l, err := s.repo.Locale(ctx, booksID, memberID)
	if err != nil {
		return locale.Locale{}, fmt.Errorf("load locale of books %d: %w", booksID, err)
	}

	return l, nil
}

// IsAdmin reports whether a member has the role admin (ADR 025 F8).
func (s *Service) IsAdmin(ctx context.Context, memberID int64) (bool, error) {
	user, err := s.repo.MemberByID(ctx, memberID)
	if err != nil {
		return false, fmt.Errorf("load member %d: %w", memberID, err)
	}

	return user.Role == domain.RoleAdmin, nil
}

// ProfileChange returns the language and region before and after UpdateProfile with the
// same arguments, validated, without storing anything.
func (s *Service) ProfileChange(ctx context.Context, booksID, memberID int64, language, region string) (before, after locale.Locale, err error) {
	before, err = s.Profile(ctx, booksID, memberID)
	if err != nil {
		return locale.Locale{}, locale.Locale{}, err
	}

	after = before
	if language != "" {
		after.Language = language
	}

	if region != "" {
		after.Region = region
	}

	return before, after, validateLocale(after)
}

// BooksSettings are the settings of one book (BK22).
type BooksSettings struct {
	Region string
	// TimeZone is nil while the book uses DefaultTimeZone.
	TimeZone        *string
	DefaultTimeZone string
}

// BooksSettings returns the region and the time zone of the books.
func (s *Service) BooksSettings(ctx context.Context, booksID int64) (BooksSettings, error) {
	region, timeZone, err := s.repo.BooksZone(ctx, booksID)
	if err != nil {
		return BooksSettings{}, fmt.Errorf("load settings of books %d: %w", booksID, err)
	}

	return BooksSettings{Region: region, TimeZone: timeZone, DefaultTimeZone: s.defaultTimeZone(region)}, nil
}

// UpdateBooksSettings validates and stores the region and the time zone; a nil timeZone restores
// the default of the region.
func (s *Service) UpdateBooksSettings(ctx context.Context, booksID int64, region string, timeZone *string) (BooksSettings, error) {
	if !locale.ValidRegion(region) {
		return BooksSettings{}, &domain.FieldError{Field: "region", Message: "must be an ISO 3166-1 alpha-2 code"}
	}

	if timeZone != nil && !validTimeZone(*timeZone) {
		return BooksSettings{}, ErrTimeZoneInvalid
	}

	if err := s.repo.UpdateBooksSettings(ctx, booksID, region, timeZone); err != nil {
		return BooksSettings{}, fmt.Errorf("update settings of books %d: %w", booksID, err)
	}

	return BooksSettings{Region: region, TimeZone: timeZone, DefaultTimeZone: s.defaultTimeZone(region)}, nil
}

// Appearance returns the stored JSON object of the member.
func (s *Service) Appearance(ctx context.Context, memberID int64) ([]byte, error) {
	doc, err := s.repo.Appearance(ctx, memberID)
	if err != nil {
		return nil, fmt.Errorf("load appearance of member %d: %w", memberID, err)
	}

	return doc, nil
}

// SetAppearance stores the JSON object of the member; ErrAppearanceTooLarge when it is over
// MaxAppearanceBytes.
func (s *Service) SetAppearance(ctx context.Context, memberID int64, doc []byte) error {
	if len(doc) > MaxAppearanceBytes {
		return ErrAppearanceTooLarge
	}

	if err := s.repo.SetAppearance(ctx, memberID, doc); err != nil {
		return fmt.Errorf("store appearance of member %d: %w", memberID, err)
	}

	return nil
}

// UpdateProfile changes the language of the member and the region of the books; an empty field keeps the stored value.
func (s *Service) UpdateProfile(ctx context.Context, booksID, memberID int64, language, region string) (locale.Locale, error) {
	_, l, err := s.ProfileChange(ctx, booksID, memberID, language, region)
	if err != nil {
		return locale.Locale{}, err
	}

	if err := s.repo.UpdateProfile(ctx, memberID, booksID, l); err != nil {
		return locale.Locale{}, err
	}

	return l, nil
}

type Session struct {
	MemberID  int64
	BooksID   int64
	Token     string
	ExpiresAt time.Time
}

// Login counts every attempt against the email, including the successful one,
// which then clears the count.
func (s *Service) Login(ctx context.Context, email, plain string) (Session, error) {
	now := s.now()
	email, emailErr := domain.NormalizeEmail(email)
	// Byte bound equivalent to MaxPasswordLength runes (at most 4 bytes each); rejects before hashing.
	if emailErr != nil || len(plain) > 4*domain.MaxPasswordLength {
		return Session{}, ErrInvalidCredentials
	}

	if !s.throttle.attempt(email, now) {
		return Session{}, ErrTooManyAttempts
	}

	user, err := s.repo.MemberByEmail(ctx, email)
	switch {
	case errors.Is(err, ErrNotFound):
		if _, err := s.verify(ctx, plain, s.dummyHash); err != nil {
			return Session{}, err
		}

		return Session{}, ErrInvalidCredentials
	case err != nil:
		return Session{}, fmt.Errorf("load member: %w", err)
	}

	ok, err := s.verify(ctx, plain, user.PasswordHash)
	if err != nil {
		return Session{}, fmt.Errorf("verify password of member %d: %w", user.ID, err)
	}

	if !ok || user.Disabled {
		return Session{}, ErrInvalidCredentials
	}

	s.throttle.reset(email)

	if err := s.repo.DeleteExpiredSessions(ctx, now); err != nil {
		return Session{}, fmt.Errorf("delete expired sessions: %w", err)
	}

	booksID, err := s.repo.LoginBooks(ctx, user.ID)
	if errors.Is(err, ErrNotFound) {
		return Session{}, ErrInvalidCredentials
	}

	if err != nil {
		return Session{}, fmt.Errorf("load login books of member %d: %w", user.ID, err)
	}

	return s.startSession(ctx, user.ID, booksID, now)
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

// Authenticate returns the member and the active books ID; ErrUnauthenticated for unknown or expired tokens and disabled members.
func (s *Service) Authenticate(ctx context.Context, token string) (domain.Member, int64, error) {
	user, booksID, err := s.repo.MemberBySession(ctx, domain.HashToken(token), s.now())
	switch {
	case errors.Is(err, ErrNotFound):
		return domain.Member{}, 0, ErrUnauthenticated
	case err != nil:
		return domain.Member{}, 0, fmt.Errorf("load session: %w", err)
	case user.Disabled:
		return domain.Member{}, 0, ErrUnauthenticated
	}

	return user, booksID, nil
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

// validTimeZone rejects the empty name and "Local", which LoadLocation accepts.
func validTimeZone(name string) bool {
	if name == "" || name == "Local" {
		return false
	}

	_, err := time.LoadLocation(name)

	return err == nil
}
