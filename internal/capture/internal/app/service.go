// Package app holds the capture use case: preview a text as transaction drafts.
package app

import (
	"context"
	"errors"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/capture/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// MaxLines is the most non-blank lines one preview reads (A106).
const MaxLines = 100

var ErrTooManyLines = errors.New("the text has more than 100 lines")

// ErrDefaultAccount: the default account is not an account a line may name (A111).
var ErrDefaultAccount = errors.New("the default account is not an open balance account")

// Account is a balance account as the ledger holds it.
type Account struct {
	ID, ParentID                  uuid.UUID
	Name, Class, Kind, SystemRole string
	Instrument                    money.Currency
	Closed                        bool
	Institution                   string
	CardsLastFour                 []string
}

type Payee struct {
	ID   uuid.UUID
	Name string
}

// Ledger is what the capture reads from the ledger.
type Ledger interface {
	Vocabulary(ctx context.Context, userID int64) ([]Account, []Payee, error)
	BaseCurrency(ctx context.Context, userID int64) (money.Currency, error)
	// Transactions returns the user's transactions among ids in the order of ids; unknown ids
	// are omitted.
	Transactions(ctx context.Context, userID int64, ids []uuid.UUID) ([]Transaction, error)
	Today() time.Time
}

// Entry is an expense or income line, signed as the posting on its account. NamedPayee is
// the payee whose name equals the description (A113).
type Entry struct {
	AccountID   uuid.UUID
	Date        time.Time
	Amount      money.Money
	Description string
	NamedPayee  uuid.UUID
}

// Decision is classification's outcome for an entry; CategoryID is zero unless the
// outcome is one category.
type Decision struct {
	PayeeID    uuid.UUID
	CategoryID uuid.UUID
	Method     string
	Tags       []string
}

type Classifier interface {
	Decide(ctx context.Context, userID int64, entries []Entry) ([]Decision, error)
}

// Line is a read line with the payee and category the owner's books decide for it.
type Line struct {
	domain.Line
	PayeeID        uuid.UUID
	CategoryID     uuid.UUID
	CategorySource string
}

// Profiles supplies the language and region a user's lines are read in.
type Profiles interface {
	Profile(ctx context.Context, userID int64) (locale.Locale, error)
}

type Clock interface{ Now() time.Time }

type Service struct {
	ledger     Ledger
	classifier Classifier
	hints      HintRepository
	profiles   Profiles
	// suggester is nil when no language model is wired (ADR 014 L6).
	suggester Suggester
	clock     Clock
}

func NewService(l Ledger, c Classifier, h HintRepository, p Profiles, sg Suggester, clk Clock) *Service {
	return &Service{ledger: l, classifier: c, hints: h, profiles: p, suggester: sg, clock: clk}
}

// Preview reads text into drafts (A106–A113). It records nothing.
func (s *Service) Preview(ctx context.Context, userID int64, text string, defaultAccount uuid.UUID) ([]Line, error) {
	blank := 0
	pieces := domain.SplitLines(text)
	for _, p := range pieces {
		if strings.TrimSpace(p) == "" {
			blank++
		}
	}
	if len(pieces)-blank > MaxLines {
		return nil, ErrTooManyLines
	}
	accounts, payees, err := s.ledger.Vocabulary(ctx, userID)
	if err != nil {
		return nil, err
	}
	base, err := s.ledger.BaseCurrency(ctx, userID)
	if err != nil {
		return nil, err
	}
	profile, err := s.profiles.Profile(ctx, userID)
	if err != nil {
		return nil, err
	}
	v := vocabulary(accounts, base, profile)
	if defaultAccount != uuid.Nil && !slices.ContainsFunc(v.Accounts, func(a domain.Account) bool { return a.ID == defaultAccount }) {
		return nil, ErrDefaultAccount
	}
	y, m, d := s.ledger.Today().Date()
	read := domain.Read(text, v, time.Date(y, m, d, 0, 0, 0, 0, time.UTC), defaultAccount)
	lines := make([]Line, len(read))
	names := payeeNames(payees)
	var entries []Entry
	var at []int
	for i, l := range read {
		lines[i] = Line{Line: l}
		if e, ok := entryOf(l); ok {
			e.NamedPayee = names[domain.Normalize(l.Description)]
			entries = append(entries, e)
			at = append(at, i)
		}
	}
	if len(entries) == 0 {
		return lines, nil
	}
	decisions, err := s.classifier.Decide(ctx, userID, entries)
	if err != nil {
		return nil, err
	}
	for k, d := range decisions {
		l := &lines[at[k]]
		l.PayeeID = d.PayeeID
		if l.PayeeID == uuid.Nil {
			l.PayeeID = entries[k].NamedPayee
		}
		if d.CategoryID != uuid.Nil {
			l.CategoryID, l.CategorySource = d.CategoryID, d.Method
		}
		for _, t := range d.Tags {
			if !slices.Contains(l.Tags, t) {
				l.Tags = append(l.Tags, t)
			}
		}
	}
	return lines, nil
}

// vocabulary keeps the accounts a line may name: open balance accounts without children,
// without a system role, held in a currency (A111).
func vocabulary(accounts []Account, base money.Currency, profile locale.Locale) domain.Vocabulary {
	parents := map[uuid.UUID]bool{}
	for _, a := range accounts {
		parents[a.ParentID] = true
	}
	c := locale.ConventionsOf(profile)
	v := domain.Vocabulary{
		Base:        base,
		Lexicon:     domain.Merge(lexiconOf(profile.Language), domain.English()),
		Conventions: domain.Conventions{Decimal: c.Decimal, Group: c.Group, Order: domain.DateOrder(c.Order)},
	}
	for _, a := range accounts {
		if a.Closed || a.SystemRole != "" || parents[a.ID] || (a.Class != "asset" && a.Class != "liability") {
			continue
		}
		if _, err := money.ParseCurrency(string(a.Instrument)); err != nil {
			continue
		}
		handles := []string{a.Name}
		if a.Institution != "" {
			handles = append(handles, a.Institution)
		}
		for _, digits := range a.CardsLastFour {
			handles = append(handles, "final "+digits, "*"+digits)
		}
		v.Accounts = append(v.Accounts, domain.Account{ID: a.ID, Class: a.Class, Kind: a.Kind, Currency: a.Instrument, Handles: handles})
	}
	return v
}

// lexiconOf returns the words of a language; a language without words reads with English.
func lexiconOf(language string) domain.Lexicon {
	if language == "pt" {
		return domain.Portuguese()
	}
	return domain.English()
}

// entryOf returns the entry classification decides for an expense or income line that has
// an account and an amount.
func entryOf(l domain.Line) (Entry, bool) {
	if l.Kind == domain.KindTransfer || l.AccountID == uuid.Nil || l.Amount == 0 {
		return Entry{}, false
	}
	amount := l.Amount
	if l.Kind == domain.KindExpense {
		amount = -amount
	}
	m, err := money.New(amount, l.Currency)
	if err != nil {
		return Entry{}, false
	}
	return Entry{AccountID: l.AccountID, Date: l.Date, Amount: m, Description: l.Description}, true
}

// payeeNames maps a normalized name to its payee; a name two payees share maps to none.
func payeeNames(payees []Payee) map[string]uuid.UUID {
	out := map[string]uuid.UUID{}
	shared := map[string]bool{}
	for _, p := range payees {
		key := domain.Normalize(p.Name)
		if _, ok := out[key]; ok {
			shared[key] = true
		}
		out[key] = p.ID
	}
	for key := range shared {
		delete(out, key)
	}
	delete(out, "")
	return out
}
