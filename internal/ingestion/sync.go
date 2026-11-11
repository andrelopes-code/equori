package ingestion

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
)

// SyncConnection syncs every mapped account of a connection now (P6 amendment A36).
func (m *Module) SyncConnection(ctx context.Context, booksID int64, connectionID uuid.UUID) error {
	_, _, err := m.svc.SyncConnection(ctx, booksID, connectionID)
	return err
}

// Tick syncs the connections whose item has new data and logs each failure by equori ids
// only (P6 amendments A43, A44).
func (m *Module) Tick(ctx context.Context) {
	failures, err := m.svc.Tick(ctx)
	for _, f := range failures {
		m.log.Warn("sync failed", "books_id", f.BooksID, "connection_id", f.ConnectionID.String(), "error", f.Err.Error())
	}

	if err != nil && ctx.Err() == nil {
		m.log.Error("sync tick failed", "error", err.Error())
	}
}

// RunScheduler ticks now and then after each stored interval until ctx ends (BK23).
func (m *Module) RunScheduler(ctx context.Context) {
	for {
		m.Tick(ctx)

		minutes, err := m.svc.SyncInterval(ctx)
		if err != nil {
			m.log.Error("read sync interval", "error", err.Error())

			minutes = app.DefaultSyncIntervalMinutes
		}

		t := time.NewTimer(time.Duration(minutes) * time.Minute)
		select {
		case <-ctx.Done():
			t.Stop()

			return
		case <-t.C:
		}
	}
}
