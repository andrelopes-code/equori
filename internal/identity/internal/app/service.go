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
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

var (
	ErrNotFound                = errors.New("not found")
	ErrEmailTaken              = errors.New("email already registered")
	ErrAdminRequired           = errors.New("the instance role admin is required")
	ErrInvalidCredentials      = errors.New("invalid credentials")
	ErrTooManyAttempts         = errors.New("too many login attempts")
	ErrUnauthenticated         = errors.New("unauthenticated")
	ErrBusy                    = errors.New("too many concurrent password operations")
	ErrBooksNotFound           = errors.New("books not found")
	ErrBookRoleRequired        = errors.New("book role required")
	ErrMemberNotFound          = errors.New("member not found")
	ErrLastOwner               = errors.New("last owner")
	ErrConfirmationMismatch    = errors.New("the typed name is not the book name")
	ErrBooksHasMembers         = errors.New("the book has other members")
	ErrLastBooks               = errors.New("the only book of a member")
	ErrAlreadyMember           = errors.New("already a member")
	ErrInvitationNotFound      = errors.New("invitation not found")
	ErrInvitationEmailMismatch = errors.New("invitation for another email")
	ErrTimeZoneInvalid         = errors.New("time zone is not an IANA name")
	// ErrAppearanceTooLarge reports an appearance object over MaxAppearanceBytes.
	ErrAppearanceTooLarge = errors.New("appearance over 16 KiB")
)

// Repository returns ErrNotFound for missing rows and ErrEmailTaken on duplicate email.
type Repository interface {
	CreateMember(ctx context.Context, u domain.Member, region string, base money.Currency) (domain.Member, int64, error)
	// CreateFirstMember returns ErrSetupComplete when a member exists.
	CreateFirstMember(ctx context.Context, u domain.Member, b FirstBooks) (domain.Member, int64, error)
	AnyMember(ctx context.Context) (bool, error)
	// UpdateProfile stores the language of the member and the region of the books in one transaction.
	UpdateProfile(ctx context.Context, memberID, booksID int64, l locale.Locale) error
	// Locale returns ErrNotFound without rows.
	Locale(ctx context.Context, booksID, memberID int64) (locale.Locale, error)
	// LoginBooks returns ErrNotFound without rows.
	LoginBooks(ctx context.Context, memberID int64) (int64, error)
	// BooksZone returns ErrNotFound without the row; timeZone is nil while the book uses the default of its region.
	BooksZone(ctx context.Context, booksID int64) (region string, timeZone *string, err error)
	BooksName(ctx context.Context, booksID int64) (string, error)
	// UpdateBooksSettings returns the stored name; a nil name keeps it.
	UpdateBooksSettings(ctx context.Context, booksID int64, region string, timeZone, name *string) (string, error)
	// TouchMembership returns ErrNotFound without the membership.
	TouchMembership(ctx context.Context, memberID, booksID int64, at time.Time) error
	// SwitchSession touches the membership and moves the session in one transaction; ErrBooksNotFound
	// without the membership, also on a foreign key violation (spec section 9).
	SwitchSession(ctx context.Context, tokenHash []byte, memberID, booksID int64, at time.Time) error
	MemberBooks(ctx context.Context, memberID int64) ([]BooksMembership, error)
	Members(ctx context.Context, booksID int64) ([]Membership, error)
	// ChangeRole and RemoveMembership lock the book row first; ErrMemberNotFound, ErrLastOwner.
	ChangeRole(ctx context.Context, booksID, memberID int64, role auth.BookRole) error
	RemoveMembership(ctx context.Context, booksID, memberID int64) error
	// DeleteBooks deletes the book with all its data under the lock of its row (DB1 to DB5):
	// ErrConfirmationMismatch, ErrBooksHasMembers, ErrLastBooks.
	DeleteBooks(ctx context.Context, booksID, memberID int64, name string) error
	// CreateBooks creates the book and its owner membership and publishes identity.books_created.v1.
	CreateBooks(ctx context.Context, memberID int64, language, name, region string, base money.Currency) (int64, error)
	// Appearance returns the stored JSON object of the member.
	Appearance(ctx context.Context, memberID int64) ([]byte, error)
	// SetAppearance replaces the stored JSON object of the member.
	SetAppearance(ctx context.Context, memberID int64, doc []byte) error
	// SetDisplayName stores the name of the member; an empty name clears it.
	SetDisplayName(ctx context.Context, memberID int64, name string) error
	MemberByID(ctx context.Context, memberID int64) (domain.Member, error)
	MemberByEmail(ctx context.Context, email string) (domain.Member, error)
	CreateSession(ctx context.Context, s domain.Session) error
	MemberBySession(ctx context.Context, tokenHash []byte, now time.Time) (Access, error)
	DeleteSession(ctx context.Context, tokenHash []byte) error
	DeleteExpiredSessions(ctx context.Context, now time.Time) error
	AccessTokenRepository
	InvitationRepository
	SecondFactorRepository
}

// FirstBooks is the book that CreateFirstMember creates with the first member.
type FirstBooks struct {
	Name, Region string
	Base         money.Currency
	// TimeZone is nil to keep the region's default.
	TimeZone *string
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
	cost      password.Cost
	setup     setup
	box       Sealer
}

func NewService(
	repo Repository,
	now func() time.Time,
	defaultTimeZone func(region string) string,
	cost password.Cost,
) *Service {
	return &Service{
		repo:            repo,
		now:             now,
		defaultTimeZone: defaultTimeZone,
		throttle:        newThrottle(loginAttemptLimit, loginAttemptWindow),
		hashSlots:       make(chan struct{}, runtime.NumCPU()),
		dummyHash:       password.Hash("dummy password for timing equalization", cost),
		cost:            cost,
	}
}

func (s *Service) CreateMember(ctx context.Context, email, plain string, role domain.Role, l locale.Locale, base money.Currency) (domain.Member, error) {
	u, err := s.newMember(ctx, email, plain, role, l.Language)
	if err != nil {
		return domain.Member{}, err
	}

	if err := validateBooks(l.Region, base); err != nil {
		return domain.Member{}, err
	}

	created, _, err := s.repo.CreateMember(ctx, u, l.Region, base)

	return created, err
}

// newMember validates a new member and hashes its password.
func (s *Service) newMember(ctx context.Context, email, plain string, role domain.Role, language string) (domain.Member, error) {
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

	if err := validateLanguage(language); err != nil {
		return domain.Member{}, err
	}

	release, err := s.acquireHashSlot(ctx)
	if err != nil {
		return domain.Member{}, err
	}

	hash := password.Hash(plain, s.cost)

	release()

	return domain.Member{Email: email, PasswordHash: hash, Role: role, Language: language}, nil
}

// validateBooks checks the region and the base currency of a new book.
func validateBooks(region string, base money.Currency) error {
	if err := validateRegion(region); err != nil {
		return err
	}

	if _, err := money.ParseCurrency(string(base)); err != nil {
		return &domain.FieldError{Field: "base_currency", Message: "must be an ISO 4217 currency code"}
	}

	return nil
}

func validateLocale(l locale.Locale) error {
	if err := validateLanguage(l.Language); err != nil {
		return err
	}

	return validateRegion(l.Region)
}

func validateLanguage(language string) error {
	if !locale.ValidLanguage(language) {
		return &domain.FieldError{Field: "language", Message: "must be an ISO 639 language code"}
	}

	return nil
}

func validateRegion(region string) error {
	if !locale.ValidRegion(region) {
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
	Name   string
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

	name, err := s.repo.BooksName(ctx, booksID)
	if err != nil {
		return BooksSettings{}, fmt.Errorf("load name of books %d: %w", booksID, err)
	}

	return BooksSettings{Name: name, Region: region, TimeZone: timeZone, DefaultTimeZone: s.defaultTimeZone(region)}, nil
}

// UpdateBooksSettings validates and stores the name, the region and the time zone; a nil name keeps
// the stored one and a nil timeZone restores the default of the region.
func (s *Service) UpdateBooksSettings(ctx context.Context, booksID int64, region string, timeZone, name *string) (BooksSettings, error) {
	if !locale.ValidRegion(region) {
		return BooksSettings{}, &domain.FieldError{Field: "region", Message: "must be an ISO 3166-1 alpha-2 code"}
	}

	if timeZone != nil && !validTimeZone(*timeZone) {
		return BooksSettings{}, ErrTimeZoneInvalid
	}

	stored, err := s.repo.UpdateBooksSettings(ctx, booksID, region, timeZone, name)
	if err != nil {
		return BooksSettings{}, fmt.Errorf("update settings of books %d: %w", booksID, err)
	}

	return BooksSettings{Name: stored, Region: region, TimeZone: timeZone, DefaultTimeZone: s.defaultTimeZone(region)}, nil
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

// SetDisplayName stores the trimmed name of the member; an empty name clears it. It returns the
// stored name, or a *domain.FieldError for an invalid one.
func (s *Service) SetDisplayName(ctx context.Context, memberID int64, name string) (string, error) {
	name, err := domain.NormalizeDisplayName(name)
	if err != nil {
		return "", err
	}

	if err := s.repo.SetDisplayName(ctx, memberID, name); err != nil {
		return "", fmt.Errorf("store display name of member %d: %w", memberID, err)
	}

	return name, nil
}

type Session struct {
	MemberID  int64
	BooksID   int64
	Token     string
	ExpiresAt time.Time
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

// Access is an authenticated member in its active book.
type Access struct {
	Member  domain.Member
	BooksID int64
	Role    auth.BookRole
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
func (s *Service) Books(ctx context.Context, memberID, activeBooksID int64) ([]BooksMembership, error) {
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
func (s *Service) SwitchBooks(ctx context.Context, memberID int64, sessionToken string, booksID int64) error {
	return s.repo.SwitchSession(ctx, domain.HashToken(sessionToken), memberID, booksID, s.now())
}

// CreateBooks creates a book with the member as owner; a nil name takes the member's email and an
// empty base takes the default of the region (HA6).
func (s *Service) CreateBooks(ctx context.Context, memberID int64, name *string, region string, base money.Currency) (BooksMembership, error) {
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
func (s *Service) ChangeRole(ctx context.Context, booksID, memberID int64, role auth.BookRole) error {
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
