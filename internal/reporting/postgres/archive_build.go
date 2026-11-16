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

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/reporting/app"
)

// sharedTables hold rows of every book; the archive carries all of them.
var sharedTables = []string{
	"marketdata_holiday",
	"marketdata_index_rate",
	"marketdata_instrument",
	"marketdata_instrument_symbol",
	"marketdata_fixed_income_terms",
	"marketdata_price",
}

// ownInstruments selects the codes the exporting book may carry: the public ones and its own
// (A236 FC1, D1).
const ownInstruments = `SELECT code FROM marketdata_instrument WHERE books_id IS NULL OR books_id = $1`

// sharedConditions limit a shared table to the rows of the exporting book and of no other book.
var sharedConditions = map[string]string{
	"marketdata_instrument":         `(t.books_id IS NULL OR t.books_id = $1)`,
	"marketdata_instrument_symbol":  `t.instrument IN (` + ownInstruments + `)`,
	"marketdata_fixed_income_terms": `t.instrument_code IN (` + ownInstruments + `)`,
	"marketdata_price":              `t.instrument IN (` + ownInstruments + `)`,
}

// rowExpressions write a row of t without books_id; a table listed here drops more.
var rowExpressions = map[string]string{
	// The bytes travel as a file of their own.
	"ledger_attachment_blob": `to_jsonb(t) - 'books_id' - 'content'`,
	// The credential is sealed for the source instance and book (ADR 008); it never travels.
	"ingestion_integration": `(to_jsonb(t) - 'books_id') || jsonb_build_object('credential_ciphertext', ''::bytea)`,
	// The key is sealed for the source instance and book (ADR 019 P1); it travels only in the
	// credentials bundle (export design T1, T3).
	"assistant_provider": `(to_jsonb(t) - 'books_id') || jsonb_build_object('sealed_key', null)`,
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
	// Credentials is the sealed bundle of export design C3; absent when the export holds none.
	Credentials *archiveFile `json:"credentials,omitempty"`
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

func buildArchive(
	ctx context.Context,
	tx pgx.Tx,
	booksID int64,
	at time.Time,
	appVersion string,
) ([]byte, error) {
	m := newArchiveManifest(at, appVersion)
	if err := tx.QueryRow(ctx, `SELECT max(version_id) FROM goose_db_version WHERE is_applied`).
		Scan(&m.SchemaVersion); err != nil {
		return nil, fmt.Errorf("read schema version: %w", err)
	}

	facts, err := FactTables(ctx, tx)
	if err != nil {
		return nil, fmt.Errorf("list fact tables: %w", err)
	}

	var buf bytes.Buffer
	z := zip.NewWriter(&buf)
	write := archiveEntryWriter(z, &buf)

	if err := writeTables(ctx, tx, booksID, &m, write, tableSources(facts)); err != nil {
		return nil, err
	}

	if err := writeAttachments(ctx, tx, booksID, &m, write); err != nil {
		return nil, err
	}

	if err := writeCredentials(ctx, tx, booksID, &m, write); err != nil {
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

func newArchiveManifest(at time.Time, appVersion string) archiveManifest {
	return archiveManifest{
		Format:         "equori-export",
		FormatVersion:  1,
		ArchiveVersion: app.ArchiveVersion,
		AppVersion:     appVersion,
		ExportedAt:     at,
		Attachments:    []archiveFile{},
	}
}

// archiveEntryWriter returns the function that adds an entry to z and fails once buf outgrows
// the archive limit.
func archiveEntryWriter(z *zip.Writer, buf *bytes.Buffer) func(string, []byte) error {
	return func(name string, b []byte) error {
		w, err := z.Create(name)
		if err == nil {
			_, err = w.Write(b)
		}

		if err == nil && buf.Len() > app.MaxArchiveBytes {
			err = app.ErrExportTooLarge
		}

		return err
	}
}

type tableSource struct{ table, from, where string }

func tableSources(facts []string) []tableSource {
	var sources []tableSource
	for _, t := range sharedTables {
		where := cmp.Or(sharedConditions[t], "true")
		sources = append(sources, tableSource{t, "to_jsonb(t)", where})
	}

	for _, t := range facts {
		from := cmp.Or(rowExpressions[t], `to_jsonb(t) - 'books_id'`)
		sources = append(sources, tableSource{t, from, "t.books_id = $1"})
	}

	sources = append(sources, tableSource{"ledger_transaction_version", "to_jsonb(t)",
		"t.transaction_id IN (SELECT id FROM ledger_transaction WHERE books_id = $1)"})
	slices.SortFunc(
		sources,
		func(a, b tableSource) int { return strings.Compare(a.table, b.table) },
	)

	return sources
}

func writeTables(
	ctx context.Context,
	tx pgx.Tx,
	booksID int64,
	m *archiveManifest,
	write func(string, []byte) error,
	sources []tableSource,
) error {
	for _, s := range sources {
		if err := writeTable(ctx, tx, booksID, m, write, s); err != nil {
			return err
		}
	}

	return nil
}

func writeTable(
	ctx context.Context,
	tx pgx.Tx,
	booksID int64,
	m *archiveManifest,
	write func(string, []byte) error,
	s tableSource,
) error {
	lines, err := tableLines(ctx, tx, booksID, s)
	if err != nil {
		return err
	}

	var b bytes.Buffer
	for _, l := range lines {
		b.WriteString(l)
		b.WriteByte('\n')
	}

	file := "tables/" + s.table + ".jsonl"
	if err := write(file, b.Bytes()); err != nil {
		return err
	}

	sum := sha256.Sum256(b.Bytes())
	m.Tables = append(
		m.Tables,
		archiveTable{
			Name:   s.table,
			File:   file,
			Rows:   len(lines),
			SHA256: hex.EncodeToString(sum[:]),
		},
	)

	return nil
}

func tableLines(
	ctx context.Context,
	tx pgx.Tx,
	booksID int64,
	s tableSource,
) ([]string, error) {
	key, err := primaryKey(ctx, tx, s.table)
	if err != nil {
		return nil, fmt.Errorf("read key of %s: %w", s.table, err)
	}

	order := "to_jsonb(t)::text"
	if len(key) > 0 {
		order = strings.Join(key, ", ")
	}

	sql := fmt.Sprintf(
		`SELECT (%s)::text FROM %s t WHERE %s ORDER BY %s`,
		s.from,
		pgx.Identifier{s.table}.Sanitize(),
		s.where,
		order,
	)

	args := []any{}
	if strings.Contains(s.where, "$1") {
		args = append(args, booksID)
	}

	rows, err := tx.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", s.table, err)
	}

	lines, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", s.table, err)
	}

	return lines, nil
}

func writeAttachments(
	ctx context.Context,
	tx pgx.Tx,
	booksID int64,
	m *archiveManifest,
	write func(string, []byte) error,
) error {
	rows, err := tx.Query(
		ctx,
		`SELECT sha256, content FROM ledger_attachment_blob WHERE books_id = $1 ORDER BY sha256`,
		booksID,
	)
	if err != nil {
		return fmt.Errorf("read attachments: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var sum, content []byte
		if err := rows.Scan(&sum, &content); err != nil {
			return err
		}

		file := "attachments/" + hex.EncodeToString(sum)
		if err := write(file, content); err != nil {
			return err
		}

		m.Attachments = append(
			m.Attachments,
			archiveFile{File: file, SHA256: hex.EncodeToString(sum)},
		)
	}

	return rows.Err()
}

// writeCredentials adds the bundle that the request stored (export design C2) as an archive entry.
func writeCredentials(
	ctx context.Context,
	tx pgx.Tx,
	booksID int64,
	m *archiveManifest,
	write func(string, []byte) error,
) error {
	var bundle []byte
	if err := tx.QueryRow(ctx, `SELECT credentials FROM reporting_export WHERE books_id = $1`, booksID).
		Scan(&bundle); err != nil &&
		!errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("read credentials: %w", err)
	}

	if len(bundle) == 0 {
		return nil
	}

	if err := write(app.CredentialsFile, bundle); err != nil {
		return err
	}

	sum := sha256.Sum256(bundle)
	m.Credentials = &archiveFile{File: app.CredentialsFile, SHA256: hex.EncodeToString(sum[:])}

	return nil
}
