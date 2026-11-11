package marketdata

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/auth"
)

// feedRun is the outcome of the last tick that ran a feed (ADR 025 F5).
type feedRun struct {
	at  time.Time
	err string
}

// Refresh starts a tick that outlives the request (ADR 025 F7).
func (m *Module) Refresh(ctx context.Context) error {
	if err := m.requireAdmin(ctx); err != nil {
		return err
	}

	if !m.running.CompareAndSwap(false, true) {
		return ErrRefreshRunning
	}

	m.again.Store(false)

	m.refreshes.Go(func() {
		m.TickFeeds(m.life)
		m.running.Store(false)

		// A request that came during the tick finds RunFeeds skipping it (D10).
		if m.again.Load() {
			m.wake()
		}
	})

	return nil
}

// WaitRefresh returns when no requested tick runs.
func (m *Module) WaitRefresh() { m.refreshes.Wait() }

func (m *Module) ran(id string, err error) {
	run := feedRun{at: m.feeds.Clock.Now()}
	if err != nil {
		run.err = err.Error()
	}

	m.runsMu.Lock()
	defer m.runsMu.Unlock()

	if m.runs == nil {
		m.runs = make(map[string]feedRun)
	}

	m.runs[id] = run
}

func (m *Module) requireAdmin(ctx context.Context) error {
	ok, err := m.admins.IsAdmin(ctx, auth.MustMemberID(ctx))
	if err != nil {
		return err
	}

	if !ok {
		return ErrAdminRequired
	}

	return nil
}
