package app

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json/jsontext"
	"encoding/json/v2"
	"errors"
	"fmt"
	"io"
	"slices"
	"strings"

	"github.com/google/uuid"
)

var (
	ErrArchiveInvalid = errors.New("the archive does not read as an export of this instance")
	ErrArchiveTooNew  = errors.New("the archive was written by a later version")
	ErrImportNotEmpty = errors.New("the books already hold facts")
	ErrImportConflict = errors.New("an identifier of the archive belongs to another book")
)

// ArchiveTable is a table of an archive with one JSON object per row.
type ArchiveTable struct {
	Name string
	Rows [][]byte
}

type TableCount struct {
	Name string
	Rows int
}

// ArchiveTooNewError names the archive_version of an archive above the instance's (ADR 021, V4).
type ArchiveTooNewError struct{ Archive, Instance int }

func (e *ArchiveTooNewError) Error() string {
	return fmt.Sprintf("%v: archive version %d, instance version %d", ErrArchiveTooNew, e.Archive, e.Instance)
}

func (e *ArchiveTooNewError) Unwrap() error { return ErrArchiveTooNew }

// ImportCredentials is what the owner says about the credentials of an archive: the passphrase
// that restores them, or Skip to import without them.
type ImportCredentials struct {
	Passphrase string
	Skip       bool
}

// ImportResult is the archive_version read and the rows written per table, in import order.
// CredentialsInArchive tells that the archive carries credentials; CredentialsRestored counts
// the integrations whose credential was written (export design C7).
type ImportResult struct {
	ArchiveVersion       int
	Tables               []TableCount
	CredentialsInArchive bool
	CredentialsRestored  int
}

type ImportRepository interface {
	// ImportableTables are the tables an archive may carry on this instance.
	ImportableTables(ctx context.Context) ([]string, error)
	// Import writes the tables in one transaction (export design E4, steps 2 to 4);
	// attachments are keyed by the hexadecimal SHA-256 of their bytes. credentials holds the
	// sealed credential of each integration by id; the transaction writes those of the imported
	// integrations and returns their count (export design C6).
	Import(ctx context.Context, booksID int64, tables []ArchiveTable, attachments map[string][]byte, credentials map[uuid.UUID][]byte) ([]TableCount, int, error)
}

type archiveManifest struct {
	Format         string `json:"format"`
	FormatVersion  int    `json:"format_version"`
	ArchiveVersion *int   `json:"archive_version"`
	Tables         []struct {
		Name   string `json:"name"`
		File   string `json:"file"`
		Rows   int    `json:"rows"`
		SHA256 string `json:"sha256"`
	} `json:"tables"`
	Attachments []struct {
		File   string `json:"file"`
		SHA256 string `json:"sha256"`
	} `json:"attachments"`
	Credentials *struct {
		File   string `json:"file"`
		SHA256 string `json:"sha256"`
	} `json:"credentials"`
}

// Import migrates an archive of an earlier version, restores it into the books of a book
// without facts, then rebuilds the derived tables (export design E4, ADR 021). An archive that
// carries credentials needs their passphrase, opened before any write, or the choice to skip them
// (export design C5).
func (s *Exports) Import(ctx context.Context, booksID int64, archive []byte, creds ImportCredentials) (ImportResult, error) {
	files, err := unzip(archive, MaxExpandedBytes)
	if err != nil {
		return ImportResult{}, err
	}

	var m archiveManifest
	if err := json.Unmarshal(files["manifest.json"], &m); err != nil || m.Format != "equori-export" || m.FormatVersion != 1 {
		return ImportResult{}, fmt.Errorf("%w: manifest", ErrArchiveInvalid)
	}

	// ADR 021, V1: an archive written before archive_version existed is version 1.
	version := 1
	if m.ArchiveVersion != nil {
		version = *m.ArchiveVersion
	}

	switch {
	case version < 1:
		return ImportResult{}, fmt.Errorf("%w: archive version %d", ErrArchiveInvalid, version)
	case version > ArchiveVersion:
		return ImportResult{}, &ArchiveTooNewError{Archive: version, Instance: ArchiveVersion}
	}

	tables := make([]ArchiveTable, 0, len(m.Tables))
	for _, t := range m.Tables {
		b, ok := files[t.File]
		if !ok || !matches(b, t.SHA256) {
			return ImportResult{}, fmt.Errorf("%w: table %s", ErrArchiveInvalid, t.Name)
		}

		var rows [][]byte
		for line := range strings.Lines(string(b)) {
			row := []byte(strings.TrimSuffix(line, "\n"))
			if !jsontext.Value(row).IsValid() || len(row) == 0 || row[0] != '{' {
				return ImportResult{}, fmt.Errorf("%w: a row of %s", ErrArchiveInvalid, t.Name)
			}

			rows = append(rows, row)
		}

		if len(rows) != t.Rows {
			return ImportResult{}, fmt.Errorf("%w: rows of %s", ErrArchiveInvalid, t.Name)
		}

		tables = append(tables, ArchiveTable{Name: t.Name, Rows: rows})
	}

	tables, err = migrateArchive(tables, version, archiveSteps)
	if err != nil {
		return ImportResult{}, fmt.Errorf("%w: %w", ErrArchiveInvalid, err)
	}

	allowed, err := s.imports.ImportableTables(ctx)
	if err != nil {
		return ImportResult{}, err
	}

	for _, t := range tables {
		if !slices.Contains(allowed, t.Name) {
			return ImportResult{}, fmt.Errorf("%w: table %s", ErrArchiveInvalid, t.Name)
		}
	}

	attachments := map[string][]byte{}
	for _, a := range m.Attachments {
		b, ok := files[a.File]
		if !ok || a.File != "attachments/"+a.SHA256 || !matches(b, a.SHA256) {
			return ImportResult{}, fmt.Errorf("%w: attachment %s", ErrArchiveInvalid, a.File)
		}

		attachments[a.SHA256] = b
	}

	var bundle []byte

	if m.Credentials != nil {
		b, ok := files[m.Credentials.File]
		if m.Credentials.File != CredentialsFile || !ok || !matches(b, m.Credentials.SHA256) {
			return ImportResult{}, fmt.Errorf("%w: %s", ErrArchiveInvalid, CredentialsFile)
		}

		bundle = b
	}

	sealed, err := s.resealCredentials(booksID, bundle, creds)
	if err != nil {
		return ImportResult{}, err
	}

	counts, restored, err := s.imports.Import(ctx, booksID, tables, attachments, sealed)
	if err != nil {
		return ImportResult{}, err
	}

	for _, rebuild := range s.rebuilds {
		if err := rebuild(ctx, booksID); err != nil {
			return ImportResult{}, fmt.Errorf("rebuild after import: %w", err)
		}
	}

	return ImportResult{ArchiveVersion: version, Tables: counts, CredentialsInArchive: m.Credentials != nil, CredentialsRestored: restored}, nil
}

// resealCredentials opens the credentials entry of the archive with the passphrase and seals each
// credential for this instance; nil when the archive has none or the owner skips them.
func (s *Exports) resealCredentials(booksID int64, bundle []byte, c ImportCredentials) (map[uuid.UUID][]byte, error) {
	switch {
	case bundle == nil:
		return nil, nil
	case c.Passphrase == "" && c.Skip:
		return nil, nil
	case c.Passphrase == "":
		return nil, ErrPassphraseRequired
	case s.creds == nil:
		return nil, ErrCredentialsUnavailable
	}

	return s.creds.Reseal(booksID, c.Passphrase, bundle)
}

func matches(b []byte, sum string) bool {
	got := sha256.Sum256(b)
	return hex.EncodeToString(got[:]) == sum
}

func unzip(archive []byte, total int64) (map[string][]byte, error) {
	r, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrArchiveInvalid, err)
	}

	files := map[string][]byte{}
	remaining := total

	for _, f := range r.File {
		rc, err := f.Open()
		if err != nil {
			return nil, fmt.Errorf("%w: %w", ErrArchiveInvalid, err)
		}

		// Each entry is capped like the archive and all entries share total, so a small archive
		// cannot expand without bound.
		b, err := io.ReadAll(io.LimitReader(rc, min(MaxArchiveBytes, remaining)+1))

		err = errors.Join(err, rc.Close())
		if err != nil || int64(len(b)) > min(MaxArchiveBytes, remaining) {
			return nil, fmt.Errorf("%w: %s", ErrArchiveInvalid, f.Name)
		}

		remaining -= int64(len(b))
		files[f.Name] = b
	}

	return files, nil
}
