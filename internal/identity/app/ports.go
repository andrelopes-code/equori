package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// AccessTokenRepository stores personal access tokens; every method but AccessTokenByHash filters by member.
type AccessTokenRepository interface {
	CreateAccessToken(ctx context.Context, t domain.AccessToken) error
	AccessTokens(ctx context.Context, memberID, booksID int64) ([]domain.AccessToken, error)
	// DeleteAccessToken returns ErrAccessTokenNotFound when the member has no token with id.
	DeleteAccessToken(ctx context.Context, memberID int64, id uuid.UUID) error
	// AccessTokenByHash returns ErrNotFound for an unknown or expired token.
	AccessTokenByHash(ctx context.Context, hash []byte, now time.Time) (domain.AccessToken, error)
	TouchAccessToken(ctx context.Context, t domain.AccessToken, now time.Time) error
}

// InvitationRepository stores invitations; postgres/ implements it.
type InvitationRepository interface {
	// SaveInvitation deletes the book's expired invitations, then stores inv; ErrAlreadyMember when the
	// email has a membership in the book.
	SaveInvitation(ctx context.Context, inv domain.Invitation) (domain.Invitation, error)
	// Invitations deletes the book's expired invitations and returns the others.
	Invitations(ctx context.Context, booksID int64, now time.Time) ([]domain.Invitation, error)
	// DeleteInvitation returns ErrInvitationNotFound when the book has no invitation with id.
	DeleteInvitation(ctx context.Context, booksID int64, id uuid.UUID) error
	// InvitationPreview returns ErrInvitationNotFound for an unknown or expired token hash.
	InvitationPreview(
		ctx context.Context,
		tokenHash []byte,
		now time.Time,
	) (InvitationPreview, error)
	// AcceptAsNewMember deletes the invitation and creates m with its membership in one transaction;
	// ErrInvitationNotFound, ErrEmailTaken.
	AcceptAsNewMember(
		ctx context.Context,
		tokenHash []byte,
		m domain.Member,
		now time.Time,
	) (domain.Member, int64, error)
	// SaveAccountInvitation deletes the expired account invitations, then stores inv; ErrEmailTaken
	// when a member has the email.
	SaveAccountInvitation(
		ctx context.Context,
		inv domain.AccountInvitation,
	) (domain.AccountInvitation, error)
	// AccountInvitationPreview returns ErrInvitationNotFound for an unknown or expired token hash.
	AccountInvitationPreview(
		ctx context.Context,
		tokenHash []byte,
		now time.Time,
	) (InvitationPreview, error)
	// AcceptAccountInvitation deletes the invitation, creates m and its book in one transaction;
	// ErrInvitationNotFound, ErrEmailTaken.
	AcceptAccountInvitation(
		ctx context.Context,
		tokenHash []byte,
		m domain.Member,
		now time.Time,
	) (domain.Member, int64, error)
	// AcceptAsMember deletes the invitation, adds the membership and moves the session in one
	// transaction; ErrInvitationNotFound, ErrAlreadyMember.
	AcceptAsMember(
		ctx context.Context,
		tokenHash []byte,
		memberID int64,
		sessionHash []byte,
		now time.Time,
	) error
}

// Sealer seals values bound to their row (ADR 008).
type Sealer interface {
	Seal(plaintext, associated []byte) ([]byte, error)
	Open(sealed, associated []byte) ([]byte, error)
	NeedsReseal(sealed []byte) bool
}

// SecondFactorRepository stores second factors; postgres/ implements it.
type SecondFactorRepository interface {
	SecondFactor(ctx context.Context, memberID int64) (SecondFactor, error)
	HasSecondFactor(ctx context.Context, memberID int64) (bool, error)
	// SaveTOTP stores an unconfirmed secret; ErrTOTPEnabled when a confirmed one exists.
	SaveTOTP(ctx context.Context, memberID int64, sealed []byte, at time.Time) error
	// TOTP returns ErrNotFound without a row.
	TOTP(ctx context.Context, memberID int64) (domain.TOTP, error)
	// ConfirmTOTP confirms at step under a lock of the member row and applies f when no factor
	// existed, reported as first; ErrTOTPCodeInvalid when no unconfirmed row has last_step below step.
	ConfirmTOTP(ctx context.Context, memberID, step int64, f FirstFactor) (first bool, err error)
	// AddPasskey is ConfirmTOTP for a new passkey; ErrPasskeyInvalid when the credential ID exists.
	AddPasskey(ctx context.Context, p domain.Passkey, f FirstFactor) (first bool, err error)
	// DisableTOTP and RemovePasskey delete the recovery codes when no factor is left; RemovePasskey
	// returns ErrPasskeyNotFound.
	DisableTOTP(ctx context.Context, memberID int64) error
	RemovePasskey(ctx context.Context, memberID int64, id uuid.UUID) error
	// ReplaceRecoveryCodes returns ErrSecondFactorMissing without a factor.
	ReplaceRecoveryCodes(ctx context.Context, memberID int64, hashes [][]byte, at time.Time) error
	SavePasskeyChallenge(
		ctx context.Context,
		memberID int64,
		challenge []byte,
		expiresAt time.Time,
	) error
	// TakePasskeyChallenge deletes the row; ErrNotFound without one or when it expired at now.
	TakePasskeyChallenge(ctx context.Context, memberID int64, now time.Time) ([]byte, error)
	// UseTOTPStep, UseRecoveryCode and UsePasskey return false for a refused factor.
	UseTOTPStep(ctx context.Context, memberID, step int64) (bool, error)
	UseRecoveryCode(ctx context.Context, memberID int64, hash []byte) (left int, ok bool, err error)
	UsePasskey(
		ctx context.Context,
		memberID int64,
		id uuid.UUID,
		signCount uint32,
		at time.Time,
	) (bool, error)
	CreateLoginChallenge(ctx context.Context, c domain.LoginChallenge) error
	// LoginChallenge returns ErrNotFound for an unknown or expired token hash.
	LoginChallenge(
		ctx context.Context,
		tokenHash []byte,
		now time.Time,
	) (domain.LoginChallenge, error)
	// CountLoginAttempt counts one answer before it is checked; ok is false when the pending login is
	// unknown, expired or has used limit attempts.
	CountLoginAttempt(
		ctx context.Context,
		tokenHash []byte,
		now time.Time,
		limit int32,
	) (attempts int32, ok bool, err error)
	// DeleteLoginChallenge returns false when no row was deleted.
	DeleteLoginChallenge(ctx context.Context, tokenHash []byte) (bool, error)
	DeleteExpiredLoginChallenges(ctx context.Context, now time.Time) error
	// ResetSecondFactor deletes every factor, challenge, pending login and session of the member in
	// one transaction (HA49).
	ResetSecondFactor(ctx context.Context, memberID int64) error
	// ResealTOTP stores each non-nil result of reseal; it returns the count stored.
	ResealTOTP(
		ctx context.Context,
		reseal func(memberID int64, sealed []byte) ([]byte, error),
	) (int, error)
}

// Repository stores members and books; postgres/ implements it.
// Repository returns ErrNotFound for missing rows and ErrEmailTaken on duplicate email.
type Repository interface {
	CreateMember(
		ctx context.Context,
		u domain.Member,
		region string,
		base money.Currency,
	) (domain.Member, int64, error)
	// CreateFirstMember returns ErrSetupComplete when a member exists.
	CreateFirstMember(
		ctx context.Context,
		u domain.Member,
		b FirstBooks,
	) (domain.Member, int64, error)
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
	UpdateBooksSettings(
		ctx context.Context,
		booksID int64,
		region string,
		timeZone, name *string,
	) (string, error)
	// TouchMembership returns ErrNotFound without the membership.
	TouchMembership(ctx context.Context, memberID, booksID int64, at time.Time) error
	// SwitchSession touches the membership and moves the session in one transaction; ErrBooksNotFound
	// without the membership, also on a foreign key violation (spec section 9).
	SwitchSession(
		ctx context.Context,
		tokenHash []byte,
		memberID, booksID int64,
		at time.Time,
	) error
	MemberBooks(ctx context.Context, memberID int64) ([]BooksMembership, error)
	Members(ctx context.Context, booksID int64) ([]Membership, error)
	// ChangeRole and RemoveMembership lock the book row first; ErrMemberNotFound, ErrLastOwner.
	ChangeRole(ctx context.Context, booksID, memberID int64, role auth.BookRole) error
	RemoveMembership(ctx context.Context, booksID, memberID int64) error
	// DeleteBooks deletes the book with all its data under the lock of its row (DB1 to DB5):
	// ErrConfirmationMismatch, ErrBooksHasMembers, ErrLastBooks.
	DeleteBooks(ctx context.Context, booksID, memberID int64, name string) error
	// CreateBooks creates the book and its owner membership and publishes identity.books_created.v1.
	CreateBooks(
		ctx context.Context,
		memberID int64,
		language, name, region string,
		base money.Currency,
	) (int64, error)
	// Appearance returns the stored JSON object of the member.
	Appearance(ctx context.Context, memberID int64) ([]byte, error)
	// SetAppearance replaces the stored JSON object of the member.
	SetAppearance(ctx context.Context, memberID int64, doc []byte) error
	// SetBirthDate stores the birth date of the member; nil clears it.
	SetBirthDate(ctx context.Context, memberID int64, date *time.Time) error
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
