package app

import (
	"context"
	"errors"
)

const DefaultSyncIntervalMinutes = 60

var ErrAdminRequired = errors.New("only an admin changes the instance's sync interval")

// Admins tells whether a member holds the admin instance role.
type Admins interface {
	IsAdmin(ctx context.Context, memberID int64) (bool, error)
}

// SyncInterval returns the stored interval, or DefaultSyncIntervalMinutes without one.
func (s *Service) SyncInterval(ctx context.Context) (int, error) {
	minutes, ok, err := s.repo.SyncInterval(ctx)
	if err != nil {
		return 0, err
	}

	if !ok {
		return DefaultSyncIntervalMinutes, nil
	}

	return minutes, nil
}

// SetSyncInterval stores the interval for an admin and returns it; any other member gets
// ErrAdminRequired.
func (s *Service) SetSyncInterval(ctx context.Context, memberID int64, minutes int) (int, error) {
	admin, err := s.admins.IsAdmin(ctx, memberID)
	if err != nil {
		return 0, err
	}

	if !admin {
		return 0, ErrAdminRequired
	}

	if err := s.repo.SetSyncInterval(ctx, minutes); err != nil {
		return 0, err
	}

	return minutes, nil
}
