// Package app holds the use cases of the instance module.
package app

import (
	"context"
	"errors"
	"log/slog"
	"sync"

	"github.com/andrelopes-code/equori/internal/instance/domain"
	"github.com/andrelopes-code/equori/internal/platform/clock"
)

var (
	ErrAdminRequired = errors.New(
		"only an admin reads or changes the instance's backups, diagnostic and version settings",
	)
	ErrBackupOff    = errors.New("automatic backups are off; set EQUORI_BACKUP_DIR")
	ErrBackupFailed = errors.New("the backup failed; the server log holds the cause")

	ErrPasswordTooShort = errors.New("the copy password needs at least 12 characters")
	ErrSecretKeyMissing = errors.New("the copy password needs EQUORI_SECRET_KEY")
)

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
	// versions guards latest.
	versions sync.Mutex
	latest   *domain.Release
}

func NewService(
	repo Repository,
	catalog Catalog,
	releases Releases,
	admins Admins,
	box Sealer,
	clk clock.Clock,
	cfg Config,
	log *slog.Logger,
) *Service {
	return &Service{
		repo:     repo,
		catalog:  catalog,
		releases: releases,
		admins:   admins,
		box:      box,
		clock:    clk,
		cfg:      cfg,
		log:      log,
	}
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
