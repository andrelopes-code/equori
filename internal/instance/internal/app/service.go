// Package app holds the use cases of the instance module.
package app

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/andrelopes-code/equori/internal/instance/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/logring"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

var (
	ErrAdminRequired = errors.New("only an admin reads or changes the instance's backups, diagnostic and version settings")
	ErrBackupOff     = errors.New("automatic backups are off; set EQUORI_BACKUP_DIR")
	ErrBackupFailed  = errors.New("the backup failed; the server log holds the cause")

	ErrPasswordTooShort = errors.New("the copy password needs at least 12 characters")
	ErrSecretKeyMissing = errors.New("the copy password needs EQUORI_SECRET_KEY")
)

type Repository interface {
	Settings(ctx context.Context) (domain.Settings, error)
	SetCopyPassword(ctx context.Context, sealed []byte) error
	SaveCopyAttempt(ctx context.Context, state domain.CopyState, attemptAt time.Time, copyAt *time.Time, copyFile *string) error
	SetUpdateCheck(ctx context.Context, consent bool) error
}

// Catalog reads the database's own catalog for the diagnostic file.
type Catalog interface {
	Tables(ctx context.Context) ([]domain.Table, error)
	Server(ctx context.Context) (domain.Server, error)
}

// Releases reads the newest release of the project.
type Releases interface {
	Latest(ctx context.Context) (tag, url string, err error)
}

type Admins interface {
	IsAdmin(ctx context.Context, memberID int64) (bool, error)
}

// Sealer is the secret box of ADR 008.
type Sealer interface {
	Seal(plaintext, associated []byte) ([]byte, error)
	Open(sealed, associated []byte) ([]byte, error)
	NeedsReseal(sealed []byte) bool
}

// Config is what the service needs from the module's configuration.
type Config struct {
	BackupDir string
	CopyDir   string
	Dump      func(ctx context.Context, path string) error
	// Schema is the schema version of the binary.
	Schema int64
	Mode   string
	// Distribution is EQUORI_DISTRIBUTION (A194.1).
	Distribution string
	Version      string
	Environment  []string
	Log          func() []logring.Record
	Outbox       func(ctx context.Context) ([]outbox.Count, error)
	Connections  func(ctx context.Context) ([]domain.Connection, error)
}

type Service struct {
	repo     Repository
	catalog  Catalog
	releases Releases
	admins   Admins
	box      Sealer // nil without EQUORI_SECRET_KEY
	clock    clock.Clock
	cfg      Config
	log      *slog.Logger
	// backups serializes Backup, so "Back up now" and the periodic backup never write together.
	backups sync.Mutex
	// versions guards latest and lastCheck.
	versions  sync.Mutex
	latest    *domain.Release
	lastCheck time.Time
}

func NewService(repo Repository, catalog Catalog, releases Releases, admins Admins, box Sealer, clk clock.Clock, cfg Config, log *slog.Logger) *Service {
	return &Service{repo: repo, catalog: catalog, releases: releases, admins: admins, box: box, clock: clk, cfg: cfg, log: log}
}

func (s *Service) requireAdmin(ctx context.Context, memberID int64) error {
	admin, err := s.admins.IsAdmin(ctx, memberID)
	if err != nil {
		return err
	}

	if !admin {
		return ErrAdminRequired
	}

	return nil
}
