package domain

import (
	"slices"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Connection is one aggregator item, read through an integration (P6 amendment A34).
type Connection struct {
	ID             uuid.UUID
	UserID         int64
	IntegrationID  uuid.UUID
	ItemID         string
	Name           string
	ProviderStatus string
	// State is the aggregator's reading of ProviderStatus; the repository does not store it.
	State            ConnectionState
	LastItemUpdateAt *time.Time
	// NextItemUpdateAt is when the provider will next update the item, as the last check read
	// it (A95).
	NextItemUpdateAt *time.Time
	LastSyncedAt     *time.Time
	LastError        string
	CreatedAt        time.Time
	Accounts         []ExternalAccount
}

// ConnectionName is the owner's name for the item, else the connector's, cut to 60 characters.
func ConnectionName(name, connector string) (string, error) {
	if name = strings.TrimSpace(name); name != "" {
		if utf8.RuneCountInString(name) > maxNameLength {
			return "", invalid("name", "must have 1 to 60 characters")
		}
		return name, nil
	}
	name = strings.TrimSpace(connector)
	if r := []rune(name); len(r) > maxNameLength {
		name = string(r[:maxNameLength])
	}
	if name == "" {
		return "", invalid("name", "is required: the item has no connector name")
	}
	return name, nil
}

type MappingState string

const (
	MappingPending MappingState = "pending"
	MappingMapped  MappingState = "mapped"
	MappingIgnored MappingState = "ignored"
)

// ExternalAccount is an account of a connection's item (A35). Only mapped accounts sync.
type ExternalAccount struct {
	ID           uuid.UUID
	UserID       int64
	ConnectionID uuid.UUID
	ExternalID   string
	Type         string
	Subtype      string
	Name         string
	// FormerNames are the names the institution reported before renaming the account (A94).
	FormerNames  []string
	NumberLast4  string
	Currency     string
	AccountID    *uuid.UUID
	SyncFrom     *time.Time
	Ignored      bool
	LastSyncedOn *time.Time
	// Balance is the last balance a sync asserted for the account (A42).
	Balance *Balance
}

// SyncWindow is the period a sync reads: from the mapping's start date on the first sync,
// then from 30 days before the last synced date, through today (A36).
func (a ExternalAccount) SyncWindow(today time.Time) (from, to time.Time) {
	from = *a.SyncFrom
	if a.LastSyncedOn != nil {
		if f := a.LastSyncedOn.AddDate(0, 0, -30); f.After(from) {
			from = f
		}
	}
	return from, today
}

// AccountRead is one account of an item as an aggregator reports it for a window.
type AccountRead struct {
	ItemStatus    string
	ItemUpdatedAt *time.Time
	// Balance is the bank balance at the date of the item's last update; nil for cards.
	Balance *Balance
	Records []NormalizedRecord
	// Seen holds the id of every line returned, recorded or not.
	Seen []string
	// Bills are a card's statements as the institution reports them (A85).
	Bills []Bill
}

// Bill is a card statement as the institution reports it; Total is positive when owed.
type Bill struct {
	Closing *time.Time
	Due     time.Time
	Total   int64
	Minimum *int64
}

func (a ExternalAccount) State() MappingState {
	switch {
	case a.AccountID != nil:
		return MappingMapped
	case a.Ignored:
		return MappingIgnored
	}
	return MappingPending
}

// LastDigits keeps the last four digits of an account number; the full number is never stored (N16).
func LastDigits(number string) string {
	digits := strings.Map(func(r rune) rune {
		if unicode.IsDigit(r) && r < utf8.RuneSelf {
			return r
		}
		return -1
	}, number)
	return digits[max(0, len(digits)-4):]
}

// SubtypeReservedBalance is the subtype of an external account that is a reserved balance
// inside a bank account (A73).
const SubtypeReservedBalance = "RESERVED_BALANCE"

// compatibleKinds lists the ledger account kinds an aggregator subtype may feed (A35).
var compatibleKinds = map[string][]string{
	"CHECKING_ACCOUNT":     {"checking"},
	"SAVINGS_ACCOUNT":      {"savings", "reserve"},
	"CREDIT_CARD":          {"credit_card"},
	SubtypeReservedBalance: {"reserve"},
}

// Mapping is the owner's choice for an external account: a ledger account from a start
// date, or ignored.
type Mapping struct {
	AccountID *uuid.UUID
	SyncFrom  *time.Time
	Ignored   bool
}

// ImportTarget is what the ledger tells about an account that may receive statement lines.
type ImportTarget struct {
	Currency money.Currency
	Kind     string
}

// Validate checks the shape of a mapping before the ledger account is read.
func (m Mapping) Validate() error {
	switch {
	case m.Ignored && (m.AccountID != nil || m.SyncFrom != nil):
		return invalid("ignored", "cannot be combined with account_id or sync_from")
	case m.Ignored:
		return nil
	case m.AccountID == nil:
		return invalid("account_id", "is required unless ignored is true")
	case m.SyncFrom == nil:
		return invalid("sync_from", "is required with account_id")
	}
	return nil
}

// Apply maps the account to target, a leaf balance account of the ledger, or ignores it.
func (a ExternalAccount) Apply(m Mapping, target ImportTarget) (ExternalAccount, error) {
	if err := m.Validate(); err != nil {
		return a, err
	}
	if m.Ignored {
		a.AccountID, a.SyncFrom, a.Ignored = nil, nil, true
		return a, nil
	}
	if string(target.Currency) != a.Currency {
		return a, invalid("account_id", "must have the external account's currency "+a.Currency)
	}
	if !slices.Contains(compatibleKinds[a.Subtype], target.Kind) {
		return a, invalid("account_id", "kind "+target.Kind+" cannot receive a "+a.Subtype+" account")
	}
	a.AccountID, a.SyncFrom, a.Ignored = m.AccountID, m.SyncFrom, false
	return a, nil
}
