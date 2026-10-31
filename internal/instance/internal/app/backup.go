package app

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"
	"unicode/utf8"

	"github.com/andrelopes-code/equori/internal/instance/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/backup"
)

// copyPasswordRow binds the sealed copy password to its column (ADR 008).
var copyPasswordRow = []byte("instance_settings.copy_password")

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
		Copy: domain.CopyStatus(s.cfg.CopyDir != "", s.passwordSet(settings), settings, now),
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

// SetCopyPassword seals the password of the encrypted copies for an admin (A155.2, A155.3).
func (s *Service) SetCopyPassword(ctx context.Context, memberID int64, password string) error {
	if err := s.requireAdmin(ctx, memberID); err != nil {
		return err
	}

	if utf8.RuneCountInString(password) < domain.MinPasswordLength {
		return ErrPasswordInvalid
	}

	if s.box == nil {
		return ErrSecretKeyMissing
	}

	sealed, err := s.box.Seal([]byte(password), copyPasswordRow)
	if err != nil {
		return fmt.Errorf("seal copy password: %w", err)
	}

	return s.repo.SetCopyPassword(ctx, sealed)
}

// RotateSecrets reseals the copy password under the current key and returns 1 when it did.
func (s *Service) RotateSecrets(ctx context.Context) (int, error) {
	if s.box == nil {
		return 0, ErrSecretKeyMissing
	}

	settings, err := s.repo.Settings(ctx)
	if err != nil {
		return 0, err
	}

	if len(settings.CopyPassword) == 0 || !s.box.NeedsReseal(settings.CopyPassword) {
		return 0, nil
	}

	plain, err := s.box.Open(settings.CopyPassword, copyPasswordRow)
	if err != nil {
		return 0, fmt.Errorf("open copy password: %w", err)
	}

	sealed, err := s.box.Seal(plain, copyPasswordRow)
	if err != nil {
		return 0, fmt.Errorf("seal copy password: %w", err)
	}

	if err := s.repo.SetCopyPassword(ctx, sealed); err != nil {
		return 0, err
	}

	return 1, nil
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

	if err := s.copyStep(ctx, now, path); err != nil {
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

// copyStep writes the encrypted copy of the dump at src, stores the outcome of the attempt and
// prunes the copy folder. A copy that is not written is logged at warn; it never fails Backup.
func (s *Service) copyStep(ctx context.Context, now time.Time, src string) error {
	settings, err := s.repo.Settings(ctx)
	if err != nil {
		return err
	}

	state, name, cause := s.writeCopy(settings, src)
	if state != domain.CopyOK {
		if cause != nil {
			s.log.WarnContext(ctx, "encrypted copy not written", "code", string(state), "error", cause)
		}

		return s.repo.SaveCopyAttempt(ctx, state, now, nil, nil)
	}

	if err := s.repo.SaveCopyAttempt(ctx, state, now, &now, &name); err != nil {
		return err
	}

	return backup.PruneCopies(s.cfg.CopyDir, backup.Periodic, domain.CopiesKept)
}

// writeCopy returns the state of the attempt and the file name of the copy; cause is set for
// the states that point at a fault.
func (s *Service) writeCopy(settings domain.Settings, src string) (state domain.CopyState, name string, cause error) {
	if s.cfg.CopyDir == "" {
		return domain.CopyFolderUnset, "", nil
	}

	if s.box == nil || len(settings.CopyPassword) == 0 {
		return domain.CopyPasswordUnset, "", nil
	}

	password, err := s.box.Open(settings.CopyPassword, copyPasswordRow)
	if err != nil {
		return domain.CopyPasswordUnset, "", nil
	}

	name, err = backup.Encrypt(src, s.cfg.CopyDir, string(password))
	if errors.Is(err, backup.ErrFolderNotWritable) {
		return domain.CopyFolderNotWritable, "", err
	}

	if err != nil {
		return domain.CopyFailed, "", err
	}

	return domain.CopyOK, name, nil
}

// passwordSet reports whether the stored copy password opens under the current keys.
func (s *Service) passwordSet(settings domain.Settings) bool {
	if s.box == nil || len(settings.CopyPassword) == 0 {
		return false
	}

	_, err := s.box.Open(settings.CopyPassword, copyPasswordRow)

	return err == nil
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
