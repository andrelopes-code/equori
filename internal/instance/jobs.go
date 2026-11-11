package instance

import "context"

// RunBackups writes a periodic backup every 24 hours until ctx ends; it returns at once when
// BackupDir is empty.
func (m *Module) RunBackups(ctx context.Context) { m.svc.RunBackups(ctx) }

// RunVersionChecks checks for a newer release at start and every 24 hours until ctx ends, and
// every hour after a failed check; it requests nothing without the admin's consent.
func (m *Module) RunVersionChecks(ctx context.Context) { m.svc.RunVersionChecks(ctx) }

// CheckVersion runs one check now, under the rules of A159.2.
func (m *Module) CheckVersion(ctx context.Context) error { return m.svc.CheckVersion(ctx) }

// StoreUpdateCheck stores the answer given at setup; it checks no role.
func (m *Module) StoreUpdateCheck(ctx context.Context, consent bool) error {
	return m.svc.StoreUpdateCheck(ctx, consent)
}

// RotateSecrets reseals the copy password under the current key (ADR 008 K4) and returns how
// many values it resealed.
func (m *Module) RotateSecrets(ctx context.Context) (int, error) { return m.svc.RotateSecrets(ctx) }
