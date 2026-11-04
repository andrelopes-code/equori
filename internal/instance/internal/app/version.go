package app

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/instance/internal/domain"
)

// VersionStatus is what the about topic shows an admin (A159.5).
type VersionStatus struct {
	Version     string
	UpdateCheck *bool
	Latest      *domain.Release
	Newer       bool
	// Distribution is compose, managed or other: the upgrade differs per form (A194.2).
	Distribution string
}

// VersionStatus returns the binary version, the consent and the newest release found.
func (s *Service) VersionStatus(ctx context.Context, memberID int64) (VersionStatus, error) {
	if err := s.requireAdmin(ctx, memberID); err != nil {
		return VersionStatus{}, err
	}

	return s.versionStatus(ctx)
}

// SetUpdateCheck stores the admin's answer and returns the new state.
func (s *Service) SetUpdateCheck(ctx context.Context, memberID int64, consent bool) (VersionStatus, error) {
	if err := s.requireAdmin(ctx, memberID); err != nil {
		return VersionStatus{}, err
	}

	if err := s.repo.SetUpdateCheck(ctx, consent); err != nil {
		return VersionStatus{}, err
	}

	return s.versionStatus(ctx)
}

// StoreUpdateCheck stores the answer of the setup page; it checks no role.
func (s *Service) StoreUpdateCheck(ctx context.Context, consent bool) error {
	return s.repo.SetUpdateCheck(ctx, consent)
}

// CheckVersion requests the latest release when the admin consented and the binary has a
// version (A159.2). A failed check is logged, keeps the previous answer and leaves the check
// due (A159.3).
func (s *Service) CheckVersion(ctx context.Context) error {
	settings, err := s.repo.Settings(ctx)
	if err != nil {
		return err
	}

	if settings.UpdateCheck == nil || !*settings.UpdateCheck || !domain.Checkable(s.cfg.Version) {
		return nil
	}

	now := s.clock.Now()

	tag, url, err := s.releases.Latest(ctx, domain.Prerelease(s.cfg.Version))
	if err != nil {
		s.log.WarnContext(ctx, "check for a newer release", "code", "version_check_failed", "error", err)
		return err
	}

	s.versions.Lock()
	defer s.versions.Unlock()

	s.latest = &domain.Release{Version: tag, URL: url, CheckedAt: now}

	return nil
}

// RunVersionChecks checks every hour whether the last check that answered is 24 hours old or
// absent.
func (s *Service) RunVersionChecks(ctx context.Context) {
	tick := time.NewTicker(time.Hour)
	defer tick.Stop()

	for {
		if s.checkDue() {
			_ = s.CheckVersion(ctx) // logged by CheckVersion
		}

		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}

func (s *Service) checkDue() bool {
	s.versions.Lock()
	defer s.versions.Unlock()

	return s.latest == nil || s.clock.Now().Sub(s.latest.CheckedAt) >= 24*time.Hour
}

func (s *Service) versionStatus(ctx context.Context) (VersionStatus, error) {
	settings, err := s.repo.Settings(ctx)
	if err != nil {
		return VersionStatus{}, err
	}

	s.versions.Lock()
	defer s.versions.Unlock()

	status := VersionStatus{
		Version:      s.cfg.Version,
		UpdateCheck:  settings.UpdateCheck,
		Latest:       s.latest,
		Distribution: s.distribution(),
	}
	status.Newer = s.latest != nil && domain.Newer(s.cfg.Version, s.latest.Version)

	return status, nil
}

// distribution names the form of the instance; managed mode wins over the variable (A194.2).
func (s *Service) distribution() string {
	switch {
	case s.cfg.Mode == "managed":
		return "managed"
	case s.cfg.Distribution == "compose":
		return "compose"
	default:
		return "other"
	}
}
