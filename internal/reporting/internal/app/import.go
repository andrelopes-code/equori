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
)

var (
	ErrArchiveInvalid = errors.New("the archive does not read as an export of this instance")
	ErrArchiveVersion = errors.New("the archive was written by another schema version")
	ErrImportNotEmpty = errors.New("the books already hold facts")
	ErrImportConflict = errors.New("an identifier of the archive belongs to another user")
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

type ImportRepository interface {
	SchemaVersion(ctx context.Context) (int64, error)
	// ImportableTables are the tables an archive may carry on this instance.
	ImportableTables(ctx context.Context) ([]string, error)
	// Import writes the tables in one transaction (export design E4, steps 2 to 4);
	// attachments are keyed by the hexadecimal SHA-256 of their bytes.
	Import(ctx context.Context, userID int64, tables []ArchiveTable, attachments map[string][]byte) ([]TableCount, error)
}

type archiveManifest struct {
	Format        string `json:"format"`
	FormatVersion int    `json:"format_version"`
	SchemaVersion int64  `json:"schema_version"`
	Tables        []struct {
		Name   string `json:"name"`
		File   string `json:"file"`
		Rows   int    `json:"rows"`
		SHA256 string `json:"sha256"`
	} `json:"tables"`
	Attachments []struct {
		File   string `json:"file"`
		SHA256 string `json:"sha256"`
	} `json:"attachments"`
}

// Import restores an archive into the books of a user without facts, then rebuilds the
// derived tables (export design E4).
func (s *Exports) Import(ctx context.Context, userID int64, archive []byte) ([]TableCount, error) {
	files, err := unzip(archive)
	if err != nil {
		return nil, err
	}
	var m archiveManifest
	if err := json.Unmarshal(files["manifest.json"], &m); err != nil || m.Format != "equori-export" || m.FormatVersion != 1 {
		return nil, fmt.Errorf("%w: manifest", ErrArchiveInvalid)
	}
	version, err := s.imports.SchemaVersion(ctx)
	if err != nil {
		return nil, err
	}
	if m.SchemaVersion != version {
		return nil, fmt.Errorf("%w: %d, instance %d", ErrArchiveVersion, m.SchemaVersion, version)
	}
	allowed, err := s.imports.ImportableTables(ctx)
	if err != nil {
		return nil, err
	}
	tables := make([]ArchiveTable, 0, len(m.Tables))
	for _, t := range m.Tables {
		b, ok := files[t.File]
		if !ok || !slices.Contains(allowed, t.Name) || !matches(b, t.SHA256) {
			return nil, fmt.Errorf("%w: table %s", ErrArchiveInvalid, t.Name)
		}
		var rows [][]byte
		for line := range strings.Lines(string(b)) {
			row := []byte(strings.TrimSuffix(line, "\n"))
			if !jsontext.Value(row).IsValid() || len(row) == 0 || row[0] != '{' {
				return nil, fmt.Errorf("%w: a row of %s", ErrArchiveInvalid, t.Name)
			}
			rows = append(rows, row)
		}
		if len(rows) != t.Rows {
			return nil, fmt.Errorf("%w: rows of %s", ErrArchiveInvalid, t.Name)
		}
		tables = append(tables, ArchiveTable{Name: t.Name, Rows: rows})
	}
	attachments := map[string][]byte{}
	for _, a := range m.Attachments {
		b, ok := files[a.File]
		if !ok || a.File != "attachments/"+a.SHA256 || !matches(b, a.SHA256) {
			return nil, fmt.Errorf("%w: attachment %s", ErrArchiveInvalid, a.File)
		}
		attachments[a.SHA256] = b
	}
	counts, err := s.imports.Import(ctx, userID, tables, attachments)
	if err != nil {
		return nil, err
	}
	for _, rebuild := range s.rebuilds {
		if err := rebuild(ctx, userID); err != nil {
			return nil, fmt.Errorf("rebuild after import: %w", err)
		}
	}
	return counts, nil
}

func matches(b []byte, sum string) bool {
	got := sha256.Sum256(b)
	return hex.EncodeToString(got[:]) == sum
}

func unzip(archive []byte) (map[string][]byte, error) {
	r, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrArchiveInvalid, err)
	}
	files := map[string][]byte{}
	for _, f := range r.File {
		rc, err := f.Open()
		if err != nil {
			return nil, fmt.Errorf("%w: %w", ErrArchiveInvalid, err)
		}
		// The uncompressed size is capped like the archive, so a small archive cannot expand without bound.
		b, err := io.ReadAll(io.LimitReader(rc, MaxArchiveBytes+1))
		err = errors.Join(err, rc.Close())
		if err != nil || len(b) > MaxArchiveBytes {
			return nil, fmt.Errorf("%w: %s", ErrArchiveInvalid, f.Name)
		}
		files[f.Name] = b
	}
	return files, nil
}
