package identity

import (
	"context"
)

// UseUpdateCheck sets the function that stores the update check consent given at setup.
func (m *Module) UseUpdateCheck(f func(ctx context.Context, consent bool) error) {
	m.svc.UseUpdateCheck(f)
}

// StartSetup returns the token of the first member setup while no member exists, and "" afterwards.
func (m *Module) StartSetup(ctx context.Context) (string, error) { return m.svc.StartSetup(ctx) }
