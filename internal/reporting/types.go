package reporting

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/reporting/app"
)

// ArchiveVersion is the archive_version of the exports of this binary (ADR 021, V9).
const ArchiveVersion = app.ArchiveVersion

// Credentials is lent by internal/server: the integration credentials and the provider keys of a
// book for an export archive.
type Credentials = app.Credentials

// SealedCredentials are the secrets of an archive sealed again for this instance (export design C6, T5).
type SealedCredentials = app.SealedCredentials

// Errors a Credentials source returns for the export and the import of credentials.
var (
	ErrPassphraseInvalid      = app.ErrPassphraseInvalid
	ErrCredentialsUnavailable = app.ErrCredentialsUnavailable
)

// Commitments is the committed amount of a month, lent by planning.
type Commitments interface {
	CommittedTotal(ctx context.Context, booksID int64, month time.Time) (money.Money, error)
}

// Valuations values each account's own balance at the end of a date in the base currency, lent by portfolio.
type Valuations interface {
	ValuedBalances(ctx context.Context, booksID int64, date time.Time) (map[uuid.UUID]money.Money, error)
}
