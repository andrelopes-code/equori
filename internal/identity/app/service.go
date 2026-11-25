// Package app implements the identity use cases.
package app

import (
	"context"
	"errors"
	"runtime"
	"time"

	"github.com/andrelopes-code/equori/internal/identity/password"
	"github.com/andrelopes-code/equori/internal/platform/clock"
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
	today           func(ctx context.Context) time.Time
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
		today:           todayFrom(now),
		defaultTimeZone: defaultTimeZone,
		throttle:        newThrottle(loginAttemptLimit, loginAttemptWindow),
		hashSlots:       make(chan struct{}, runtime.NumCPU()),
		dummyHash:       password.Hash("dummy password for timing equalization", cost),
		cost:            cost,
	}
}

// todayFrom reads the calendar date of now in the location of the context, as 00:00 UTC.
func todayFrom(now func() time.Time) func(ctx context.Context) time.Time {
	return func(ctx context.Context) time.Time { return clock.DateOf(now(), clock.Location(ctx)) }
}
