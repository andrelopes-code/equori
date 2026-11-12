package app

import (
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

type CreditLimit struct {
	AccountID     uuid.UUID
	EffectiveFrom time.Time
	Amount        money.Money
}

type CardSummary struct {
	CreditLimit    money.Money
	AvailableLimit money.Money
}

// Statement is a stored statement with the lines its summary is derived from.
type Statement struct {
	ID         uuid.UUID
	AccountID  uuid.UUID
	FinancedBy uuid.UUID
	Reconciled bool // the institution's amount due was confirmed (P3 amendment A7)
	Input      domain.StatementInput
	Fact       *domain.StatementFact // what the institution reported, the owner's first (A85)
}

// RedatablePosting is a card posting billed by its date (A86).
type RedatablePosting struct {
	ID          uuid.UUID
	Date        time.Time
	StatementID uuid.UUID
}

// StatementPosting is one posting billed on a statement, with its transaction context.
type StatementPosting struct {
	TransactionID uuid.UUID
	Date          time.Time
	Description   string
	CardRole      string
	Amount        int64
	Installment   *domain.InstallmentRef
	Basis         string // the source that chose the statement (A136)
	Provisional   bool   // derived by Statement from Basis (A136)
}

// PlanInstallment is one installment of a plan with the statement it is billed on.
type PlanInstallment struct {
	Number    int
	Amount    int64 // negative: a charge
	Reference domain.ReferenceMonth
	Closing   time.Time
}

type Dispute struct {
	ID                  uuid.UUID
	BooksID             int64
	TransactionID       uuid.UUID
	OpenedOn            time.Time
	ResolvedOn          *time.Time
	Outcome             string
	RefundTransactionID uuid.UUID
}

type BalanceAssertion struct {
	ID         uuid.UUID
	BooksID    int64
	AccountID  uuid.UUID
	Date       time.Time
	Amount     int64
	Source     string
	RecordedAt time.Time
	Reconciled bool
}

// Reconciliation records that an account matched its institution through Date,
// from an assertion or from a card statement (P3 amendment A7).
type Reconciliation struct {
	BooksID                 int64
	AccountID               uuid.UUID
	Date                    time.Time
	AssertionID             uuid.UUID
	StatementID             uuid.UUID
	Difference              int64
	Resolution              domain.Resolution
	ResolutionTransactionID uuid.UUID
}

type Settings struct {
	BooksID      int64
	BaseCurrency money.Currency
}

type Institution struct {
	ID      uuid.UUID
	BooksID int64
	Name    string
	Code    string
	// Identifier keys the institution's logo (ADR 013); the zero value when unknown.
	Identifier InstitutionIdentifier
}

// InstitutionIdentifier is an institution's identifier in a scheme; both fields are empty when unknown.
type InstitutionIdentifier struct {
	Scheme, Value string
}

type Payee struct {
	ID      uuid.UUID
	BooksID int64
	Name    string
	// MergedInto is the payee that replaced this one (A82); zero for a live payee.
	MergedInto uuid.UUID
}

type Version struct {
	Version     int
	Reason      string
	ReplacedAt  time.Time
	Transaction domain.Transaction
}

type AccountTotals struct {
	Total        int64
	LastBookedOn time.Time
}

// Basis selects the date that places a posting in time: the transaction date or the
// institution's settlement date (chapter 5, 5.2.3).
type Basis string

const (
	BasisBooked  Basis = "booked"
	BasisSettled Basis = "settled"
)

// AccountTotal is the sum of the postings of one account in its own instrument.
type AccountTotal struct {
	AccountID  uuid.UUID
	Instrument money.Currency
	Total      int64
}

type Balance struct {
	AccountID uuid.UUID
	Date      time.Time
	Basis     Basis
	Amount    money.Money
}

// Cursor keys. Member names differ between lists, so a cursor decodes only for the list
// that produced it (strict decoding in platform/page).
type (
	AccountKey struct {
		Class string    `json:"ac"`
		Name  string    `json:"an"` // lower(name), as PostgreSQL sorts it
		ID    uuid.UUID `json:"ai"`
	}
	InstitutionKey struct {
		Name string    `json:"in"`
		ID   uuid.UUID `json:"ii"`
	}
	PayeeKey struct {
		Name string    `json:"pn"`
		ID   uuid.UUID `json:"pi"`
	}
	TagKey struct {
		Name string `json:"tn"`
	}
	StatementKey struct {
		Reference string `json:"sr"`
	}
	AssertionKey struct {
		Date time.Time `json:"bd"`
		ID   uuid.UUID `json:"bi"`
	}
	AttachmentKey struct {
		CreatedAt time.Time `json:"fc"`
		ID        uuid.UUID `json:"fi"`
	}
)

type TransactionCursor struct {
	Date time.Time `json:"d"`
	ID   uuid.UUID `json:"i"`
}

type TransactionQuery struct {
	BooksID   int64
	AccountID uuid.UUID
	PayeeID   uuid.UUID
	Tag       string
	// Q is a list of blank-separated words, each found without regard to case or accents in the description, payee name or a posting memo; empty disables the filter.
	Q        string
	From, To *time.Time
	// AmountMin and AmountMax bound the amount moved, in minor units of the balancing currency; nil leaves a side open.
	AmountMin, AmountMax *int64
	// Uncategorized keeps only transactions in category state uncategorized.
	Uncategorized bool
	// ExcludeVoided leaves voided transactions out; the default keeps them as history.
	ExcludeVoided bool
	After         *TransactionCursor
	Limit         int
}
