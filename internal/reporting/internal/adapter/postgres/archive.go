package postgres

import (
	"archive/zip"
	"bytes"
	"cmp"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json/v2"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andrelopes-code/equori/internal/platform/outbox"
	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

// EventExportRequested starts the build of an export (export design E3).
const EventExportRequested = "reporting.export_requested.v1"

// notExported are the tables with user_id that stay out of the archive (export design E2).
var notExported = []string{
	"assistant_chain_target", "assistant_provider", "assistant_usage", "assistant_usage_limit",
	"capture_category_hint", "identity_access_token", "identity_session", "outbox_event",
	"portfolio_income_event", "portfolio_position_day", "portfolio_realized_result",
	"reporting_account_day", "reporting_export",
}

// sharedTables hold rows of every user; the archive carries all of them.
var sharedTables = []string{
	"marketdata_holiday", "marketdata_index_rate", "marketdata_instrument", "marketdata_fixed_income_terms", "marketdata_price",
}

// rowExpressions write a row of t without user_id; a table listed here drops more.
var rowExpressions = map[string]string{
	// The bytes travel as a file of their own.
	"ledger_attachment_blob": `to_jsonb(t) - 'user_id' - 'content'`,
	// The credential is sealed for the source instance and user (ADR 008); it never travels.
	"ingestion_integration": `(to_jsonb(t) - 'user_id') || jsonb_build_object('credential_ciphertext', ''::bytea)`,
}

type archiveTable struct {
	Name   string `json:"name"`
	File   string `json:"file"`
	Rows   int    `json:"rows"`
	SHA256 string `json:"sha256"`
}

type archiveFile struct {
	File   string `json:"file"`
	SHA256 string `json:"sha256"`
}

type archiveManifest struct {
	Format         string         `json:"format"`
	FormatVersion  int            `json:"format_version"`
	ArchiveVersion int            `json:"archive_version"`
	AppVersion     string         `json:"app_version"`
	SchemaVersion  int64          `json:"schema_version"`
	ExportedAt     time.Time      `json:"exported_at"`
	Tables         []archiveTable `json:"tables"`
	Attachments    []archiveFile  `json:"attachments"`
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

// FactTables returns the tables with user_id that the archive carries, by name.
func FactTables(ctx context.Context, q DBTX) ([]string, error) {
	rows, err := q.Query(ctx, `SELECT table_name FROM information_schema.columns
		WHERE table_schema = current_schema() AND column_name = 'user_id' ORDER BY table_name`)
	if err != nil {
		return nil, err
	}
	names, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, err
	}
	return slices.DeleteFunc(names, func(n string) bool { return slices.Contains(notExported, n) }), nil
}

// primaryKey returns the primary key columns of table, quoted, in key order.
func primaryKey(ctx context.Context, q DBTX, table string) ([]string, error) {
	rows, err := q.Query(ctx, `SELECT a.attname FROM pg_index i
		JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
		WHERE i.indrelid = $1::regclass AND i.indisprimary
		ORDER BY array_position(i.indkey::int2[], a.attnum)`, table)
	if err != nil {
		return nil, err
	}
	cols, err := pgx.CollectRows(rows, pgx.RowTo[string])
	for i, c := range cols {
		cols[i] = "t." + pgx.Identifier{c}.Sanitize()
	}
	return cols, err
}

func (r *Exports) BuildArchive(ctx context.Context, userID int64, at time.Time) ([]byte, error) {
	var out []byte
	err := pgx.BeginTxFunc(ctx, r.pool, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		var err error
		out, err = buildArchive(ctx, tx, userID, at, r.appVersion)
		return err
	})
	return out, err
}

func buildArchive(ctx context.Context, tx pgx.Tx, userID int64, at time.Time, appVersion string) ([]byte, error) {
	m := archiveManifest{
		Format: "equori-export", FormatVersion: 1, ArchiveVersion: app.ArchiveVersion, AppVersion: appVersion,
		ExportedAt: at, Attachments: []archiveFile{},
	}
	if err := tx.QueryRow(ctx, `SELECT max(version_id) FROM goose_db_version WHERE is_applied`).Scan(&m.SchemaVersion); err != nil {
		return nil, fmt.Errorf("read schema version: %w", err)
	}
	facts, err := FactTables(ctx, tx)
	if err != nil {
		return nil, fmt.Errorf("list fact tables: %w", err)
	}
	var buf bytes.Buffer
	z := zip.NewWriter(&buf)
	write := func(name string, b []byte) error {
		w, err := z.Create(name)
		if err == nil {
			_, err = w.Write(b)
		}
		if err == nil && buf.Len() > app.MaxArchiveBytes {
			err = app.ErrExportTooLarge
		}
		return err
	}
	type source struct{ table, from, where string }
	var sources []source
	for _, t := range sharedTables {
		sources = append(sources, source{t, "to_jsonb(t)", "true"})
	}
	for _, t := range facts {
		from := cmp.Or(rowExpressions[t], `to_jsonb(t) - 'user_id'`)
		sources = append(sources, source{t, from, "t.user_id = $1"})
	}
	sources = append(sources, source{"ledger_transaction_version", "to_jsonb(t)",
		"t.transaction_id IN (SELECT id FROM ledger_transaction WHERE user_id = $1)"})
	slices.SortFunc(sources, func(a, b source) int { return strings.Compare(a.table, b.table) })
	for _, s := range sources {
		key, err := primaryKey(ctx, tx, s.table)
		if err != nil {
			return nil, fmt.Errorf("read key of %s: %w", s.table, err)
		}
		order := "to_jsonb(t)::text"
		if len(key) > 0 {
			order = strings.Join(key, ", ")
		}
		sql := fmt.Sprintf(`SELECT (%s)::text FROM %s t WHERE %s ORDER BY %s`, s.from, pgx.Identifier{s.table}.Sanitize(), s.where, order)
		args := []any{}
		if strings.Contains(s.where, "$1") {
			args = append(args, userID)
		}
		rows, err := tx.Query(ctx, sql, args...)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", s.table, err)
		}
		lines, err := pgx.CollectRows(rows, pgx.RowTo[string])
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", s.table, err)
		}
		var b bytes.Buffer
		for _, l := range lines {
			b.WriteString(l)
			b.WriteByte('\n')
		}
		file := "tables/" + s.table + ".jsonl"
		if err := write(file, b.Bytes()); err != nil {
			return nil, err
		}
		sum := sha256.Sum256(b.Bytes())
		m.Tables = append(m.Tables, archiveTable{Name: s.table, File: file, Rows: len(lines), SHA256: hex.EncodeToString(sum[:])})
	}
	rows, err := tx.Query(ctx, `SELECT sha256, content FROM ledger_attachment_blob WHERE user_id = $1 ORDER BY sha256`, userID)
	if err != nil {
		return nil, fmt.Errorf("read attachments: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var sum, content []byte
		if err := rows.Scan(&sum, &content); err != nil {
			return nil, err
		}
		file := "attachments/" + hex.EncodeToString(sum)
		if err := write(file, content); err != nil {
			return nil, err
		}
		m.Attachments = append(m.Attachments, archiveFile{File: file, SHA256: hex.EncodeToString(sum)})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	manifest, err := json.Marshal(m)
	if err != nil {
		return nil, err
	}
	if err := write("manifest.json", manifest); err != nil {
		return nil, err
	}
	if err := z.Close(); err != nil {
		return nil, err
	}
	if buf.Len() > app.MaxArchiveBytes {
		return nil, app.ErrExportTooLarge
	}
	return buf.Bytes(), nil
}

// RequestExport writes the pending export and its event in one transaction (ADR 006).
func (r *Exports) RequestExport(ctx context.Context, userID int64, at time.Time) (app.Export, bool, error) {
	var e app.Export
	ok := true
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		row, err := r.q.WithTx(tx).RequestExport(ctx, RequestExportParams{UserID: userID, RequestedAt: at})
		if errors.Is(err, pgx.ErrNoRows) {
			ok = false
			return nil
		}
		if err != nil {
			return err
		}
		e = app.Export{ID: row.ID, Status: app.ExportStatus(row.Status), RequestedAt: row.RequestedAt}
		return outbox.Insert(ctx, tx, outbox.Event{Type: EventExportRequested, UserID: userID, AggregateID: row.ID.String(), Payload: map[string]string{"export_id": row.ID.String()}})
	})
	return e, ok, err
}

func (r *Exports) Export(ctx context.Context, userID int64) (app.Export, error) {
	row, err := r.q.GetExport(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return app.Export{}, app.ErrExportNotFound
	}
	if err != nil {
		return app.Export{}, err
	}
	e := app.Export{ID: row.ID, Status: app.ExportStatus(row.Status), RequestedAt: row.RequestedAt, FinishedAt: row.FinishedAt, Size: row.Size, SHA256: row.Sha256}
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

func (r *Exports) ExportContent(ctx context.Context, userID int64) (app.Export, []byte, error) {
	row, err := r.q.ExportContent(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return app.Export{}, nil, app.ErrExportNotFound
	}
	if err != nil {
		return app.Export{}, nil, err
	}
	return app.Export{Status: app.ExportStatus(row.Status), RequestedAt: row.RequestedAt}, row.Content, nil
}

func (r *Exports) FinishExport(ctx context.Context, userID int64, id uuid.UUID, at time.Time, archive []byte, problem string) error {
	p := FinishExportParams{UserID: userID, ID: id, FinishedAt: &at, Status: string(app.ExportReady), Content: archive}
	if problem != "" {
		p.Status, p.Problem = string(app.ExportFailed), &problem
	} else {
		sum := sha256.Sum256(archive)
		version := int32(app.ArchiveVersion)
		p.Sha256, p.ArchiveVersion = sum[:], &version
	}
	return r.q.FinishExport(ctx, p)
}
