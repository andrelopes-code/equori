package app

import (
	"context"
	"errors"
	"fmt"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

// MaxArchiveBytes is the largest archive an export builds (export design E5).
const MaxArchiveBytes = 256 << 20

// MaxExpandedBytes bounds the uncompressed size of all entries of an archive an import reads.
const MaxExpandedBytes = 4 * MaxArchiveBytes

var (
	ErrExportNotFound = errors.New("no export was requested")
	ErrExportPending  = errors.New("an export is pending")
	ErrExportNotReady = errors.New("the export is not ready")
	// ErrExportTooLarge: the archive would exceed MaxArchiveBytes.
	ErrExportTooLarge = errors.New("the archive exceeds 256 MiB")
	// ErrPassphraseLength: the passphrase of the credentials is outside 8 to 256 characters (export design C1).
	ErrPassphraseLength = errors.New("the passphrase must have 8 to 256 characters")
	// ErrCredentialsUnavailable: the instance has no EQUORI_SECRET_KEY (ADR 008, K2).
	ErrCredentialsUnavailable = errors.New("credentials need EQUORI_SECRET_KEY")
	// ErrCredentialsRole: only an owner of the book takes its credentials out or in.
	ErrCredentialsRole = errors.New("only an owner of the book exports credentials")
	// ErrPassphraseRequired: the archive carries credentials and the import gave neither the passphrase nor the choice to skip them (export design C5).
	ErrPassphraseRequired = errors.New("the archive carries credentials: give their passphrase or choose to import without them")
	// ErrPassphraseInvalid: the passphrase does not open the credentials of the archive (export design C5).
	ErrPassphraseInvalid = errors.New("the passphrase does not open the credentials of the archive")
)

// CredentialsFile is the archive entry that holds the sealed credentials (export design C3).
const CredentialsFile = "credentials.enc"

const (
	minPassphrase = 8
	maxPassphrase = 256
)

type ExportStatus string

const (
	ExportPending ExportStatus = "pending"
	ExportReady   ExportStatus = "ready"
	ExportFailed  ExportStatus = "failed"
)

// Export is the book's export; Size and SHA256 are set when ready, Problem when failed.
type Export struct {
	ID          uuid.UUID
	Status      ExportStatus
	RequestedAt time.Time
	FinishedAt  *time.Time
	Size        int64
	SHA256      []byte
	Problem     string
	// ArchiveVersion is the archive_version of a ready export's archive (ADR 021).
	ArchiveVersion int
}

type ExportRepository interface {
	// RequestExport replaces a finished export with a pending one and publishes
	// EventExportRequested in the same transaction; ok is false while one is pending.
	// credentials is the sealed bundle of export design C2, nil for none.
	RequestExport(ctx context.Context, booksID int64, at time.Time, credentials []byte) (e Export, ok bool, err error)
	Export(ctx context.Context, booksID int64) (Export, error)
	ExportContent(ctx context.Context, booksID int64) (Export, []byte, error)
	// BuildArchive reads every fact of the book from one snapshot (export design E1, E2).
	BuildArchive(ctx context.Context, booksID int64, at time.Time) ([]byte, error)
	FinishExport(ctx context.Context, booksID int64, id uuid.UUID, at time.Time, archive []byte, problem string) error
}

type Clock interface{ Now() time.Time }

// Credentials is lent by ingestion: the integration credentials of a book, sealed by a passphrase
// for the archive and sealed again for the instance that imports it (export design C2, C6).
type Credentials interface {
	// Bundle seals the credentials of the book under passphrase; nil when it stores none.
	// ErrCredentialsUnavailable without the instance key.
	Bundle(ctx context.Context, booksID int64, passphrase string) ([]byte, error)
	// Reseal opens bundle with passphrase and returns each credential sealed for booksID under
	// the key of this instance, by integration id. ErrPassphraseInvalid for a wrong passphrase or
	// a tampered bundle; ErrCredentialsUnavailable without the instance key.
	Reseal(booksID int64, passphrase string, bundle []byte) (map[uuid.UUID][]byte, error)
}

type Exports struct {
	repo     ExportRepository
	imports  ImportRepository
	clock    Clock
	rebuilds []func(ctx context.Context, booksID int64) error
	creds    Credentials
}

// NewExports takes the rebuilds of every derived table, run for the book after an import.
func NewExports(repo ExportRepository, imports ImportRepository, clk Clock, rebuilds ...func(ctx context.Context, booksID int64) error) *Exports {
	return &Exports{repo: repo, imports: imports, clock: clk, rebuilds: rebuilds}
}

// OnImport adds a rebuild of another module's derived tables.
func (s *Exports) OnImport(rebuild func(ctx context.Context, booksID int64) error) {
	s.rebuilds = append(s.rebuilds, rebuild)
}

// UseCredentials lends the credentials of the integrations; without it an archive carries none.
func (s *Exports) UseCredentials(c Credentials) { s.creds = c }

// Request starts an export. A passphrase adds the book's integration credentials to the archive
// (export design C1, C2); it is used here and never stored.
func (s *Exports) Request(ctx context.Context, booksID int64, passphrase string) (Export, error) {
	var bundle []byte

	if passphrase != "" {
		if n := utf8.RuneCountInString(passphrase); n < minPassphrase || n > maxPassphrase {
			return Export{}, ErrPassphraseLength
		}

		if s.creds == nil {
			return Export{}, ErrCredentialsUnavailable
		}

		var err error
		if bundle, err = s.creds.Bundle(ctx, booksID, passphrase); err != nil {
			return Export{}, err
		}
	}

	e, ok, err := s.repo.RequestExport(ctx, booksID, s.clock.Now(), bundle)
	if err != nil {
		return Export{}, err
	}

	if !ok {
		return Export{}, ErrExportPending
	}

	return e, nil
}

func (s *Exports) Get(ctx context.Context, booksID int64) (Export, error) {
	return s.repo.Export(ctx, booksID)
}

// Content returns the archive of a ready export with the date of its request.
func (s *Exports) Content(ctx context.Context, booksID int64) ([]byte, time.Time, error) {
	e, content, err := s.repo.ExportContent(ctx, booksID)
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
func (s *Exports) Build(ctx context.Context, booksID int64, id uuid.UUID) error {
	e, err := s.repo.Export(ctx, booksID)
	if errors.Is(err, ErrExportNotFound) || err == nil && (e.ID != id || e.Status != ExportPending) {
		return nil
	}

	if err != nil {
		return err
	}

	archive, err := s.repo.BuildArchive(ctx, booksID, e.RequestedAt)

	problem := ""
	switch {
	case errors.Is(err, ErrExportTooLarge):
		problem, archive = "export_too_large", nil
	case err != nil:
		return fmt.Errorf("build export %s: %w", id, err)
	}

	return s.repo.FinishExport(ctx, booksID, id, s.clock.Now(), archive, problem)
}
