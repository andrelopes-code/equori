// Package app implements the identity use cases.
package app

import (
	"context"
	"errors"
	"runtime"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/identity/password"
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
