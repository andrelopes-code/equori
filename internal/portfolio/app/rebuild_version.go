package app

import (
	"context"
	"errors"
)

// RebuildForVersion rebuilds every derived row once per app version: a start under a version
// other than the stored one runs RebuildAll, so a tax rule changed by the release reaches the
// rows already derived. A failed rebuild clears the stored version and the next start retries.
func (s *Service) RebuildForVersion(ctx context.Context, version string) error {
	claimed, err := s.repo.ClaimRebuildVersion(ctx, version)
	if err != nil || !claimed {
		return err
	}

	if err := s.RebuildAll(ctx); err != nil {
		return errors.Join(err, s.repo.ForgetRebuildVersion(ctx))
	}

	return nil
}
