package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// MaxArchiveBytes is the largest archive an export builds (export design E5).
const MaxArchiveBytes = 256 << 20

var (
	ErrExportNotFound = errors.New("no export was requested")
	ErrExportPending  = errors.New("an export is pending")
	ErrExportNotReady = errors.New("the export is not ready")
	// ErrExportTooLarge: the archive would exceed MaxArchiveBytes.
	ErrExportTooLarge = errors.New("the archive exceeds 256 MiB")
)

type ExportStatus string

const (
	ExportPending ExportStatus = "pending"
	ExportReady   ExportStatus = "ready"
	ExportFailed  ExportStatus = "failed"
)

// Export is the user's export; Size and SHA256 are set when ready, Problem when failed.
type Export struct {
	ID          uuid.UUID
	Status      ExportStatus
	RequestedAt time.Time
	FinishedAt  *time.Time
	Size        int64
	SHA256      []byte
	Problem     string
}

type ExportRepository interface {
	// RequestExport replaces a finished export with a pending one and publishes
	// EventExportRequested in the same transaction; ok is false while one is pending.
	RequestExport(ctx context.Context, userID int64, at time.Time) (e Export, ok bool, err error)
	Export(ctx context.Context, userID int64) (Export, error)
	ExportContent(ctx context.Context, userID int64) (Export, []byte, error)
	// BuildArchive reads every fact of the user from one snapshot (export design E1, E2).
	BuildArchive(ctx context.Context, userID int64, at time.Time) ([]byte, error)
	FinishExport(ctx context.Context, userID int64, id uuid.UUID, at time.Time, archive []byte, problem string) error
}

type Clock interface{ Now() time.Time }

type Exports struct {
	repo     ExportRepository
	imports  ImportRepository
	clock    Clock
	rebuilds []func(ctx context.Context, userID int64) error
}

// NewExports takes the rebuilds of every derived table, run for the user after an import.
func NewExports(repo ExportRepository, imports ImportRepository, clk Clock, rebuilds ...func(ctx context.Context, userID int64) error) *Exports {
	return &Exports{repo: repo, imports: imports, clock: clk, rebuilds: rebuilds}
}

// OnImport adds a rebuild of another module's derived tables.
func (s *Exports) OnImport(rebuild func(ctx context.Context, userID int64) error) {
	s.rebuilds = append(s.rebuilds, rebuild)
}

func (s *Exports) Request(ctx context.Context, userID int64) (Export, error) {
	e, ok, err := s.repo.RequestExport(ctx, userID, s.clock.Now())
	if err != nil {
		return Export{}, err
	}
	if !ok {
		return Export{}, ErrExportPending
	}
	return e, nil
}

func (s *Exports) Get(ctx context.Context, userID int64) (Export, error) {
	return s.repo.Export(ctx, userID)
}

// Content returns the archive of a ready export with the date of its request.
func (s *Exports) Content(ctx context.Context, userID int64) ([]byte, time.Time, error) {
	e, content, err := s.repo.ExportContent(ctx, userID)
	if err != nil {
		return nil, time.Time{}, err
	}
	if e.Status != ExportReady {
		return nil, time.Time{}, ErrExportNotReady
	}
	return content, e.RequestedAt, nil
}

// Build records the archive of a pending export. An archive over the limit is recorded as
// failed; any other error is returned for the dispatcher to retry (export design E3).
func (s *Exports) Build(ctx context.Context, userID int64, id uuid.UUID) error {
	e, err := s.repo.Export(ctx, userID)
	if errors.Is(err, ErrExportNotFound) || err == nil && (e.ID != id || e.Status != ExportPending) {
		return nil
	}
	if err != nil {
		return err
	}
	archive, err := s.repo.BuildArchive(ctx, userID, e.RequestedAt)
	problem := ""
	switch {
	case errors.Is(err, ErrExportTooLarge):
		problem, archive = "export_too_large", nil
	case err != nil:
		return fmt.Errorf("build export %s: %w", id, err)
	}
	return s.repo.FinishExport(ctx, userID, id, s.clock.Now(), archive, problem)
}
