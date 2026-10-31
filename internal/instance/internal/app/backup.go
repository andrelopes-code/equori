package app

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/andrelopes-code/equori/internal/instance/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/backup"
)

// BackupStatus returns the backups and the encrypted copy for an admin.
func (s *Service) BackupStatus(ctx context.Context, memberID int64) (domain.BackupStatus, error) {
	if err := s.requireAdmin(ctx, memberID); err != nil {
		return domain.BackupStatus{}, err
	}

	settings, err := s.repo.Settings(ctx)
	if err != nil {
		return domain.BackupStatus{}, err
	}

	now := s.clock.Now()
	status := domain.BackupStatus{
		On:   s.cfg.BackupDir != "",
		Copy: domain.CopyStatus(s.cfg.CopyDir != "", len(settings.CopyPassword) > 0, settings, now),
	}

	if !status.On {
		return status, nil
	}

	if status.PeriodicAt, err = s.newestAt(backup.Periodic); err != nil {
		return domain.BackupStatus{}, err
	}

	if status.PreMigrationAt, err = s.newestAt(backup.PreMigration); err != nil {
		return domain.BackupStatus{}, err
	}

	status.Late = status.PeriodicAt == nil || now.Sub(*status.PeriodicAt) >= domain.LateAfter

	return status, nil
}

// RunBackup writes a periodic backup now for an admin and returns the new state.
func (s *Service) RunBackup(ctx context.Context, memberID int64) (domain.BackupStatus, error) {
	if err := s.requireAdmin(ctx, memberID); err != nil {
		return domain.BackupStatus{}, err
	}

	if s.cfg.BackupDir == "" {
		return domain.BackupStatus{}, ErrBackupOff
	}

	if err := s.Backup(ctx); err != nil {
		return domain.BackupStatus{}, err
	}

	return s.BackupStatus(ctx, memberID)
}

// Backup writes a periodic backup, prunes the old ones and runs the copy step. A dump error
// returns ErrBackupFailed; a copy error is logged and never fails the backup.
func (s *Service) Backup(ctx context.Context) error {
	s.backups.Lock()
	defer s.backups.Unlock()

	now := s.clock.Now()
	path := filepath.Join(s.cfg.BackupDir, backup.Name(backup.Periodic, now, s.cfg.Schema))

	if err := s.cfg.Dump(ctx, path); err != nil {
		return fmt.Errorf("%w: %w", ErrBackupFailed, err)
	}

	if err := os.Chtimes(path, now, now); err != nil {
		return fmt.Errorf("%w: set backup time: %w", ErrBackupFailed, err)
	}

	if err := backup.Prune(s.cfg.BackupDir, backup.Periodic, domain.PeriodicKept); err != nil {
		return fmt.Errorf("%w: %w", ErrBackupFailed, err)
	}

	s.log.InfoContext(ctx, "backup written", "path", path)

	if err := s.copyStep(ctx, now); err != nil {
		s.log.WarnContext(ctx, "save copy state", "error", err)
	}

	return nil
}

// RunBackups writes a periodic backup when the newest is 24 hours old, checked every hour (B3).
// It returns at once when automatic backups are off.
func (s *Service) RunBackups(ctx context.Context) {
	if s.cfg.BackupDir == "" {
		return
	}

	tick := time.NewTicker(time.Hour)
	defer tick.Stop()

	for {
		s.backupIfDue(ctx)

		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}

func (s *Service) backupIfDue(ctx context.Context) {
	due, err := backup.Due(s.cfg.BackupDir, s.clock.Now(), 24*time.Hour)
	if err != nil {
		s.log.ErrorContext(ctx, "periodic backup", "error", err)
		return
	}

	if !due {
		return
	}

	if err := s.Backup(ctx); err != nil {
		s.log.ErrorContext(ctx, "periodic backup", "error", err)
	}
}

// copyStep records why no copy was written; task 4 adds the encryption.
func (s *Service) copyStep(ctx context.Context, now time.Time) error {
	state := domain.CopyPasswordUnset
	if s.cfg.CopyDir == "" {
		state = domain.CopyFolderUnset
	}

	return s.repo.SaveCopyAttempt(ctx, state, now, nil, nil)
}

func (s *Service) newestAt(prefix string) (*time.Time, error) {
	newest, err := backup.Newest(s.cfg.BackupDir, prefix)
	if err != nil || newest == "" {
		return nil, err
	}

	info, err := os.Stat(newest)
	if err != nil {
		return nil, fmt.Errorf("inspect backup: %w", err)
	}

	at := info.ModTime().UTC()

	return &at, nil
}
