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
)

var (
	ErrAdminRequired = errors.New("only an admin reads or changes the instance's backups, diagnostic and version settings")
	ErrBackupOff     = errors.New("automatic backups are off; set EQUORI_BACKUP_DIR")
	ErrBackupFailed  = errors.New("the backup failed; the server log holds the cause")
)

type Repository interface {
	Settings(ctx context.Context) (domain.Settings, error)
	SetCopyPassword(ctx context.Context, sealed []byte) error
	SaveCopyAttempt(ctx context.Context, state domain.CopyState, attemptAt time.Time, copyAt *time.Time, copyFile *string) error
	SetUpdateCheck(ctx context.Context, consent bool) error
}

type Admins interface {
	IsAdmin(ctx context.Context, memberID int64) (bool, error)
}

// Config is what the service needs from the module's configuration.
type Config struct {
	BackupDir string
	CopyDir   string
	Dump      func(ctx context.Context, path string) error
	Schema    int64
}

type Service struct {
	repo   Repository
	admins Admins
	clock  clock.Clock
	cfg    Config
	log    *slog.Logger
	// backups serializes Backup, so "Back up now" and the periodic backup never write together.
	backups sync.Mutex
}

func NewService(repo Repository, admins Admins, clk clock.Clock, cfg Config, log *slog.Logger) *Service {
	return &Service{repo: repo, admins: admins, clock: clk, cfg: cfg, log: log}
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
