package postgres

import (
	"context"
	"crypto/sha256"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/reporting/app"
)

// EventExportRequested starts the build of an export (export design E3).
const EventExportRequested = "reporting.export_requested.v1"

// notExported are the tables with books_id that stay out of the archive (export design E2).
var notExported = []string{
	"assistant_conversation", "assistant_message", "assistant_proposal",
	"assistant_usage",
	"capture_category_hint", "identity_access_token", "identity_invitation", "identity_membership",
	"identity_session", "outbox_event",
	"portfolio_income_event", "portfolio_position_day", "portfolio_realized_result",
	"reporting_account_day", "reporting_export",
}

var _ app.ExportRepository = (*Exports)(nil)

// Exports builds archives on a pool: an archive reads one snapshot of its own transaction.
type Exports struct {
	pool       *pgxpool.Pool
	q          *Queries
	appVersion string
}

// NewExports writes appVersion, the version of the running app, in each manifest (ADR 021, V1).
func NewExports(pool *pgxpool.Pool, appVersion string) *Exports {
	return &Exports{pool: pool, q: New(pool), appVersion: appVersion}
}

// FactTables returns the tables with books_id that the archive carries by book, by name; a shared
// table with books_id (marketdata_instrument) has its own condition.
func FactTables(ctx context.Context, q DBTX) ([]string, error) {
	rows, err := q.Query(ctx, `SELECT table_name FROM information_schema.columns
		WHERE table_schema = current_schema() AND column_name = 'books_id' ORDER BY table_name`)
	if err != nil {
		return nil, err
	}

	names, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, err
	}

	return slices.DeleteFunc(
		names,
		func(n string) bool {
			return slices.Contains(notExported, n) || slices.Contains(sharedTables, n)
		},
	), nil
}

func (r *Exports) BuildArchive(ctx context.Context, booksID int64, at time.Time) ([]byte, error) {
	var out []byte
	err := pgx.BeginTxFunc(
		ctx,
		r.pool,
		pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly},
		func(tx pgx.Tx) error {
			var err error
			out, err = buildArchive(ctx, tx, booksID, at, r.appVersion)

			return err
		},
	)

	return out, err
}

// RequestExport writes the pending export and its event in one transaction (ADR 006).
func (r *Exports) RequestExport(
	ctx context.Context,
	booksID int64,
	at time.Time,
	credentials []byte,
) (app.Export, bool, error) {
	var e app.Export
	ok := true
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		row, err := r.q.WithTx(tx).
			RequestExport(ctx, RequestExportParams{BooksID: booksID, RequestedAt: at, Credentials: credentials})
		if errors.Is(err, pgx.ErrNoRows) {
			ok = false
			return nil
		}

		if err != nil {
			return err
		}

		e = app.Export{
			ID:          row.ID,
			Status:      app.ExportStatus(row.Status),
			RequestedAt: row.RequestedAt,
		}

		return outbox.Insert(
			ctx,
			tx,
			outbox.Event{
				Type:        EventExportRequested,
				BooksID:     booksID,
				AggregateID: row.ID.String(),
				Payload:     map[string]string{"export_id": row.ID.String()},
			},
		)
	})

	return e, ok, err
}

func (r *Exports) Export(ctx context.Context, booksID int64) (app.Export, error) {
	row, err := r.q.GetExport(ctx, booksID)
	if errors.Is(err, pgx.ErrNoRows) {
		return app.Export{}, app.ErrExportNotFound
	}

	if err != nil {
		return app.Export{}, err
	}

	e := app.Export{
		ID:          row.ID,
		Status:      app.ExportStatus(row.Status),
		RequestedAt: row.RequestedAt,
		FinishedAt:  row.FinishedAt,
		Size:        row.Size,
		SHA256:      row.Sha256,
	}
	if row.Problem != nil {
		e.Problem = *row.Problem
	}

	switch {
	case row.ArchiveVersion != nil:
		e.ArchiveVersion = int(*row.ArchiveVersion)
	case e.Status == app.ExportReady:
		// Built by a binary older than archive_version: its manifest has no version, which reads as 1 (ADR 021, V1).
		e.ArchiveVersion = 1
	}

	return e, nil
}

func (r *Exports) ExportContent(ctx context.Context, booksID int64) (app.Export, []byte, error) {
	row, err := r.q.ExportContent(ctx, booksID)
	if errors.Is(err, pgx.ErrNoRows) {
		return app.Export{}, nil, app.ErrExportNotFound
	}

	if err != nil {
		return app.Export{}, nil, err
	}

	return app.Export{
		Status:      app.ExportStatus(row.Status),
		RequestedAt: row.RequestedAt,
	}, row.Content, nil
}

func (r *Exports) FinishExport(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	at time.Time,
	archive []byte,
	problem string,
) error {
	p := FinishExportParams{
		BooksID:    booksID,
		ID:         id,
		FinishedAt: &at,
		Status:     string(app.ExportReady),
		Content:    archive,
	}
	if problem != "" {
		p.Status, p.Problem = string(app.ExportFailed), &problem
	} else {
		sum := sha256.Sum256(archive)
		version := int32(app.ArchiveVersion)
		p.Sha256, p.ArchiveVersion = sum[:], &version
	}

	return r.q.FinishExport(ctx, p)
}
