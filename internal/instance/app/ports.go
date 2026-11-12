package app

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/instance/domain"
)

// Repository stores the instance settings; postgres/ implements it.
type Repository interface {
	Settings(ctx context.Context) (domain.Settings, error)
	SetCopyPassword(ctx context.Context, sealed []byte) error
	SaveCopyAttempt(
		ctx context.Context,
		state domain.CopyState,
		attemptAt time.Time,
		copyAt *time.Time,
		copyFile *string,
	) error
	SetUpdateCheck(ctx context.Context, consent bool) error
}

// Catalog reads the database's own catalog for the diagnostic file.
type Catalog interface {
	Tables(ctx context.Context) ([]domain.Table, error)
	Server(ctx context.Context) (domain.Server, error)
}

// Releases reads the newest release of the project.
type Releases interface {
	// Latest skips pre-releases unless prerelease is set (A159.2).
	Latest(ctx context.Context, prerelease bool) (tag, url string, err error)
}

// Admins tells whether a member holds the admin instance role; the identity module implements it.
type Admins interface {
	IsAdmin(ctx context.Context, memberID int64) (bool, error)
}

// Sealer is the secret box of ADR 008.
type Sealer interface {
	Seal(plaintext, associated []byte) ([]byte, error)
	Open(sealed, associated []byte) ([]byte, error)
	NeedsReseal(sealed []byte) bool
}
