package app

import (
	"bytes"
	"context"
	"errors"
	"maps"
	"slices"
	"strconv"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

const (
	EventTransactionRecorded  = "ledger.transaction_recorded.v1"
	EventTransactionCorrected = "ledger.transaction_corrected.v1"
	EventTransactionVoided    = "ledger.transaction_voided.v1"
	EventAccountOpened        = "ledger.account_opened.v1"
	EventAccountClosed        = "ledger.account_closed.v1"
	EventAccountReopened      = "ledger.account_reopened.v1"
)

// earliestDate is the default opening date: accounts without a known opening date accept any posting.
var earliestDate = time.Date(1900, 1, 1, 0, 0, 0, 0, time.UTC)

type Service struct {
	repo     Repository
	clock    Clock
	cal      Calendar
	ins      Instruments
	prices   Prices
	profiles Profiles
	defaults RegionDefaults
}

func NewService(repo Repository, clock Clock, cal Calendar, ins Instruments, prices Prices, profiles Profiles, defaults RegionDefaults) *Service {
	return &Service{repo: repo, clock: clock, cal: cal, ins: ins, prices: prices, profiles: profiles, defaults: defaults}
}

// Today is the date of the ledger's clock.
func (s *Service) Today() time.Time { return s.clock.Today() }

// Provision creates the settings and system accounts of a new user. It is idempotent.
func (s *Service) Provision(ctx context.Context, userID int64, base money.Currency) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		if _, err := r.Settings(ctx, userID); err == nil {
			return nil
		} else if !errors.Is(err, ErrNotFound) {
			return err
		}
		if err := r.SaveSettings(ctx, Settings{UserID: userID, BaseCurrency: base}); err != nil {
			return err
		}
		for _, role := range domain.SystemRoles() {
			a, err := domain.NewAccount(domain.Account{
				UserID: userID, Name: role.DefaultName(), Class: role.Class(),
				Instrument: base, OpenedOn: earliestDate, SystemRole: role,
			})
			if err != nil {
				return err
			}
			if _, err := r.InsertAccount(ctx, a); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Service) Settings(ctx context.Context, userID int64) (Settings, error) {
	return s.repo.Settings(ctx, userID)
}

// SetBaseCurrency is allowed only while the user has no transaction; system accounts follow the new currency.
func (s *Service) SetBaseCurrency(ctx context.Context, userID int64, c money.Currency) error {
	if _, err := money.ParseCurrency(string(c)); err != nil {
		return &domain.FieldError{Field: "base_currency", Message: "must be a supported currency", Err: domain.ErrValidation}
	}
	return s.repo.InTx(ctx, func(r Repository) error {
		n, err := r.CountTransactions(ctx, userID)
		if err != nil {
			return err
		}
		if n > 0 {
			return ErrSettingsLocked
		}
		if err := r.SaveSettings(ctx, Settings{UserID: userID, BaseCurrency: c}); err != nil {
			return err
		}
		return r.SetSystemAccountsInstrument(ctx, userID, c)
	})
}

func (s *Service) CreateInstitution(ctx context.Context, userID int64, i Institution) (Institution, error) {
	if i.Name == "" || len([]rune(i.Name)) > 120 {
		return Institution{}, &domain.FieldError{Field: "name", Message: "must have 1 to 120 characters", Err: domain.ErrValidation}
	}
	if err := validateInstitutionIdentifier(i.Identifier); err != nil {
		return Institution{}, err
	}
	i.UserID = userID
	return s.repo.InsertInstitution(ctx, i)
}

// SetInstitutionIdentifier sets the identifier of an institution, or clears it when ident is empty (ADR 013).
func (s *Service) SetInstitutionIdentifier(ctx context.Context, userID int64, id uuid.UUID, ident InstitutionIdentifier) (Institution, error) {
	if err := validateInstitutionIdentifier(ident); err != nil {
		return Institution{}, err
	}
	return s.repo.SetInstitutionIdentifier(ctx, userID, id, ident)
}

// InstitutionIdentifierSchemes lists the schemes an institution identifier may use.
func (s *Service) InstitutionIdentifierSchemes() []domain.IdentifierScheme {
	return domain.IdentifierSchemes()
}

func validateInstitutionIdentifier(ident InstitutionIdentifier) error {
	if ident == (InstitutionIdentifier{}) {
		return nil
	}
	return domain.ValidateIdentifier(ident.Scheme, ident.Value)
}

func (s *Service) ListInstitutions(ctx context.Context, userID int64, p page.Request[InstitutionKey]) ([]Institution, *InstitutionKey, error) {
	return s.repo.ListInstitutions(ctx, userID, p)
}

func (s *Service) CreatePayee(ctx context.Context, userID int64, name string) (Payee, error) {
	if name == "" || len([]rune(name)) > 120 {
		return Payee{}, &domain.FieldError{Field: "name", Message: "must have 1 to 120 characters", Err: domain.ErrValidation}
	}
	return s.repo.InsertPayee(ctx, Payee{UserID: userID, Name: name})
}

func (s *Service) ListPayees(ctx context.Context, userID int64, p page.Request[PayeeKey]) ([]Payee, *PayeeKey, error) {
	return s.repo.ListPayees(ctx, userID, p)
}

func (s *Service) PayeeNames(ctx context.Context, userID int64, ids []uuid.UUID) (map[uuid.UUID]string, error) {
	return s.repo.PayeeNames(ctx, userID, ids)
}

func (s *Service) ListTags(ctx context.Context, userID int64, p page.Request[TagKey]) ([]string, *TagKey, error) {
	return s.repo.ListTags(ctx, userID, p)
}

type accountEvent struct {
	AccountID uuid.UUID `json:"account_id"`
}

func (s *Service) CreateAccount(ctx context.Context, userID int64, a domain.Account) (domain.Account, error) {
	a.UserID = userID
	if a.OpenedOn.IsZero() {
		a.OpenedOn = earliestDate
	}
	a.SystemRole = ""
	if err := s.describeInstrument(ctx, &a); err != nil {
		return domain.Account{}, err
	}
	a, err := domain.NewAccount(a)
	if err != nil {
		return domain.Account{}, err
	}
	var created domain.Account
	err = s.repo.InTx(ctx, func(r Repository) error {
		if err := s.checkParent(ctx, r, a); err != nil {
			return err
		}
		created, err = r.InsertAccount(ctx, a)
		if err != nil {
			return err
		}
		return r.Publish(ctx, outbox.Event{Type: EventAccountOpened, UserID: userID, AggregateID: created.ID.String(), Payload: accountEvent{created.ID}})
	})
	return created, err
}

type AccountPatch struct {
	Name                  *string
	ParentID              *uuid.UUID
	InstitutionID         *uuid.UUID
	YieldMode             *domain.YieldMode
	ExcludedFromLiquidity *bool
}

func (s *Service) UpdateAccount(ctx context.Context, userID int64, id uuid.UUID, p AccountPatch) (domain.Account, error) {
	var updated domain.Account
	err := s.repo.InTx(ctx, func(r Repository) error {
		a, err := r.Account(ctx, userID, id)
		if err != nil {
			return err
		}
		if p.Name != nil {
			a.Name = *p.Name
		}
		if p.ParentID != nil {
			a.ParentID = *p.ParentID
		}
		if p.InstitutionID != nil {
			a.InstitutionID = *p.InstitutionID
		}
		if p.YieldMode != nil {
			a.YieldMode = *p.YieldMode
		}
		if p.ExcludedFromLiquidity != nil {
			a.ExcludedFromLiquidity = *p.ExcludedFromLiquidity
		}
		if err := s.describeInstrument(ctx, &a); err != nil {
			return err
		}
		if a, err = domain.NewAccount(a); err != nil {
			return err
		}
		if err := s.checkParent(ctx, r, a); err != nil {
			return err
		}
		updated, err = r.UpdateAccount(ctx, a)
		return err
	})
	return updated, err
}

// SetAppearance sets or, with zero values, clears the colour and the icon of an account (A83).
func (s *Service) SetAppearance(ctx context.Context, userID int64, id uuid.UUID, color int, icon string) (domain.Account, error) {
	var updated domain.Account
	err := s.repo.InTx(ctx, func(r Repository) error {
		a, err := r.Account(ctx, userID, id)
		if err != nil {
			return err
		}
		a.Color, a.Icon = color, icon
		if a, err = domain.NewAccount(a); err != nil {
			return err
		}
		updated, err = r.UpdateAccount(ctx, a)
		return err
	})
	return updated, err
}

func (s *Service) checkParent(ctx context.Context, r Repository, a domain.Account) error {
	if a.ParentID == uuid.Nil {
		return nil
	}
	parent, err := r.Account(ctx, a.UserID, a.ParentID)
	if errors.Is(err, ErrNotFound) {
		return &domain.FieldError{Field: "parent_id", Message: "unknown account", Err: domain.ErrUnknownAccount}
	}
	if err != nil {
		return err
	}
	if parent.IsBalance() {
		totals, err := r.AccountTotals(ctx, a.UserID, parent.ID)
		if err != nil {
			return err
		}
		if totals.Total != 0 || totals.LastBookedOn.After(earliestDate) {
			return &domain.FieldError{Field: "parent_id", Message: "a balance account with postings cannot become a parent", Err: domain.ErrValidation}
		}
	}
	if a.ClosedOn == nil && parent.ClosedOn != nil {
		return &domain.FieldError{Field: "parent_id", Message: "must be open", Err: domain.ErrValidation}
	}
	if a.ID != uuid.Nil {
		for ancestor := parent; ancestor.ParentID != uuid.Nil; {
			if ancestor.ParentID == a.ID {
				return &domain.FieldError{Field: "parent_id", Message: "must not be a descendant of the account", Err: domain.ErrValidation}
			}
			if ancestor, err = r.Account(ctx, a.UserID, ancestor.ParentID); err != nil {
				return err
			}
		}
	}
	return domain.ValidateParent(a, parent)
}

func (s *Service) Account(ctx context.Context, userID int64, id uuid.UUID) (domain.Account, error) {
	return s.repo.Account(ctx, userID, id)
}

func (s *Service) ListAccounts(ctx context.Context, userID int64, p page.Request[AccountKey]) ([]domain.Account, *AccountKey, error) {
	return s.repo.ListAccounts(ctx, userID, p)
}

// CloseAccount closes the account and its open descendants (A74). Every member needs no
// postings after the closing date; a balance-sheet or equity member also needs a zero balance.
func (s *Service) CloseAccount(ctx context.Context, userID int64, id uuid.UUID, closedOn time.Time) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		root, err := r.Account(ctx, userID, id)
		if err != nil {
			return err
		}
		all, err := r.AllAccounts(ctx, userID)
		if err != nil {
			return err
		}
		subtree := subtreeOf(root, all)
		var closing []domain.Account
		for _, a := range subtree {
			if a.SystemRole != "" {
				return ErrSystemAccount
			}
			if a.ClosedOn != nil && a.ID != root.ID {
				continue
			}
			totals, err := r.AccountTotals(ctx, userID, a.ID)
			if err != nil {
				return err
			}
			if a.Class != domain.ClassIncome && a.Class != domain.ClassExpense && totals.Total != 0 {
				return ErrNonZeroBalance
			}
			if totals.LastBookedOn.After(closedOn) {
				return ErrPostingsAfterClose
			}
			a.ClosedOn = &closedOn
			if a, err = domain.NewAccount(a); err != nil {
				return err
			}
			closing = append(closing, a)
		}
		for _, a := range closing {
			if _, err := r.UpdateAccount(ctx, a); err != nil {
				return err
			}
			if err := r.Publish(ctx, outbox.Event{Type: EventAccountClosed, UserID: userID, AggregateID: a.ID.String(), Payload: accountEvent{a.ID}}); err != nil {
				return err
			}
		}
		return nil
	})
}

// ReopenAccount reopens the account and its closed ancestors, so an open account never has a
// closed parent (A74).
func (s *Service) ReopenAccount(ctx context.Context, userID int64, id uuid.UUID) (domain.Account, error) {
	var reopened domain.Account
	err := s.repo.InTx(ctx, func(r Repository) error {
		a, err := r.Account(ctx, userID, id)
		if err != nil {
			return err
		}
		if a.SystemRole != "" {
			return ErrSystemAccount
		}
		if a.ClosedOn == nil {
			return &domain.FieldError{Field: "id", Message: "account is open", Err: domain.ErrValidation}
		}
		for {
			a.ClosedOn = nil
			updated, err := r.UpdateAccount(ctx, a)
			if err != nil {
				return err
			}
			if updated.ID == id {
				reopened = updated
			}
			if err := r.Publish(ctx, outbox.Event{Type: EventAccountReopened, UserID: userID, AggregateID: a.ID.String(), Payload: accountEvent{a.ID}}); err != nil {
				return err
			}
			if a.ParentID == uuid.Nil {
				return nil
			}
			if a, err = r.Account(ctx, userID, a.ParentID); err != nil {
				return err
			}
			if a.ClosedOn == nil {
				return nil
			}
		}
	})
	return reopened, err
}

// subtreeOf returns root followed by its descendants, parents before children.
func subtreeOf(root domain.Account, all []domain.Account) []domain.Account {
	children := map[uuid.UUID][]domain.Account{}
	for _, a := range all {
		if a.ParentID != uuid.Nil {
			children[a.ParentID] = append(children[a.ParentID], a)
		}
	}
	out := []domain.Account{root}
	for i := 0; i < len(out); i++ {
		out = append(out, children[out[i].ID]...)
	}
	return out
}

// TransactionEvent is the payload of the transaction events (ADR 006, chapter 4).
type TransactionEvent struct {
	TransactionID uuid.UUID   `json:"transaction_id"`
	Date          string      `json:"date"`
	PreviousDate  string      `json:"previous_date,omitempty"`
	AccountIDs    []uuid.UUID `json:"account_ids"`
	Version       int         `json:"version"`
	Origin        string      `json:"origin"`
	CategoryState string      `json:"category_state"`
	// CategoriesChanged is set on corrections that change the category postings.
	CategoriesChanged bool   `json:"categories_changed,omitempty"`
	Cause             *Cause `json:"cause,omitempty"`
}

// newTransactionEvent describes t; accounts holds every account of t, and AccountIDs also
// covers the accounts of the earlier versions given.
func newTransactionEvent(t domain.Transaction, accounts map[uuid.UUID]domain.Account, earlier ...domain.Transaction) TransactionEvent {
	return TransactionEvent{
		TransactionID: t.ID, Date: t.Date.Format(time.DateOnly), AccountIDs: accountIDs(append(earlier, t)...),
		Version: t.Version, Origin: string(t.Origin), CategoryState: string(t.CategoryState(accounts)),
	}
}

func accountIDs(ts ...domain.Transaction) []uuid.UUID {
	var ids []uuid.UUID
	for _, t := range ts {
		for _, p := range t.Postings {
			ids = append(ids, p.AccountID)
		}
	}
	slices.SortFunc(ids, func(a, b uuid.UUID) int { return bytes.Compare(a[:], b[:]) })
	return slices.Compact(ids)
}

func (s *Service) RecordTransaction(ctx context.Context, userID int64, t domain.Transaction) (domain.Transaction, error) {
	t.UserID = userID
	var created domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		var err error
		created, err = s.insert(ctx, r, t)
		return err
	})
	return created, err
}

// insert validates, bills, stores and publishes t inside the caller's database transaction.
func (s *Service) insert(ctx context.Context, r Repository, t domain.Transaction) (domain.Transaction, error) {
	t.ID = uuid.Must(uuid.NewV7())
	t.Version = 0
	valid, accounts, err := s.validate(ctx, r, t)
	if err != nil {
		return domain.Transaction{}, err
	}
	if err := checkLaterSales(ctx, r, t.UserID, valid.Date, valid.Postings, valid.ID); err != nil {
		return domain.Transaction{}, err
	}
	if err := s.bill(ctx, r, &valid); err != nil {
		return domain.Transaction{}, err
	}
	created, err := r.InsertTransaction(ctx, valid)
	if err != nil {
		return domain.Transaction{}, err
	}
	return created, r.Publish(ctx, outbox.Event{
		Type: EventTransactionRecorded, UserID: t.UserID, AggregateID: created.ID.String(),
		Payload: newTransactionEvent(created, accounts),
	})
}

func (s *Service) CorrectTransaction(ctx context.Context, userID int64, id uuid.UUID, expectedVersion int, next domain.Transaction, reason string) (domain.Transaction, error) {
	var corrected domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		prev, err := r.LockTransaction(ctx, userID, id)
		if err != nil {
			return err
		}
		if prev.Trade != nil || prev.Income != nil {
			return ErrInvestmentTransaction
		}
		if err := checkLaterSales(ctx, r, userID, prev.Date, prev.Postings, id); err != nil {
			return err
		}
		next.ID, next.UserID = id, userID
		if next.BalancingCurrency == "" {
			next.BalancingCurrency = prev.BalancingCurrency
		}
		accounts, err := s.references(ctx, r, next)
		if err != nil {
			return err
		}
		if err := s.addAccounts(ctx, r, userID, accounts, prev); err != nil {
			return err
		}
		if prev.HasInstallments() {
			// The postings keep their rows: the plan and the statements stay as they are.
			if corrected, err = prev.CorrectDetails(next, expectedVersion); err == nil {
				err = r.ReplaceCategoryPostings(ctx, prev, corrected, reason)
			}
		} else {
			corrected, err = s.correct(ctx, r, prev, next, expectedVersion, accounts, reason)
		}
		if err != nil {
			return err
		}
		// The stored postings carry the ids the database assigned.
		if corrected, err = r.Transaction(ctx, userID, id); err != nil {
			return err
		}
		return r.Publish(ctx, outbox.Event{
			Type: EventTransactionCorrected, UserID: userID, AggregateID: id.String(),
			Payload: func() TransactionEvent {
				e := newTransactionEvent(corrected, accounts, prev)
				e.PreviousDate = prev.Date.Format(time.DateOnly)
				e.CategoriesChanged = domain.CategoriesChanged(prev, corrected, accounts)
				return e
			}(),
		})
	})
	return corrected, err
}

// correct validates, bills and stores next as the version after prev.
func (s *Service) correct(ctx context.Context, r Repository, prev, next domain.Transaction, expectedVersion int, accounts map[uuid.UUID]domain.Account, reason string) (domain.Transaction, error) {
	corrected, err := prev.Correct(next, expectedVersion, accounts)
	if err != nil {
		return domain.Transaction{}, err
	}
	if err := checkLaterSales(ctx, r, prev.UserID, corrected.Date, corrected.Postings, prev.ID); err != nil {
		return domain.Transaction{}, err
	}
	if err := s.bill(ctx, r, &corrected); err != nil {
		return domain.Transaction{}, err
	}
	return corrected, r.ReplaceTransaction(ctx, prev, corrected, reason)
}

func (s *Service) VoidTransaction(ctx context.Context, userID int64, id uuid.UUID, reason string) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		prev, err := r.LockTransaction(ctx, userID, id)
		if err != nil {
			return err
		}
		if err := checkLaterSales(ctx, r, userID, prev.Date, prev.Postings, id); err != nil {
			return err
		}
		voided, err := prev.Void(s.clock.Now(), reason)
		if err != nil {
			return err
		}
		if err := r.VoidTransaction(ctx, voided); err != nil {
			return err
		}
		accounts, err := r.Accounts(ctx, userID, postingAccounts(prev))
		if err != nil {
			return err
		}
		return r.Publish(ctx, outbox.Event{
			Type: EventTransactionVoided, UserID: userID, AggregateID: id.String(),
			Payload: newTransactionEvent(voided, accounts),
		})
	})
}

func (s *Service) Transaction(ctx context.Context, userID int64, id uuid.UUID) (domain.Transaction, error) {
	return s.repo.Transaction(ctx, userID, id)
}

func (s *Service) Versions(ctx context.Context, userID int64, id uuid.UUID) ([]Version, error) {
	if _, err := s.repo.Transaction(ctx, userID, id); err != nil {
		return nil, err
	}
	return s.repo.Versions(ctx, userID, id)
}

// Reference is an inbound link: Source is the transaction that links to another one.
// Reference is an inbound link: Source links to another transaction. Amount, when not zero, is what a
// reimbursement_of link repays, in Currency.
type Reference struct {
	Type     domain.LinkType
	Source   uuid.UUID
	Amount   int64
	Currency string
}

// ReferencedBy returns the non-voided transactions that link to the transaction.
func (s *Service) ReferencedBy(ctx context.Context, userID int64, id uuid.UUID) ([]Reference, error) {
	if _, err := s.repo.Transaction(ctx, userID, id); err != nil {
		return nil, err
	}
	return s.repo.LinksTo(ctx, userID, id)
}

// ListTransactions returns a page and the cursor of the next page, nil on the last page.
func (s *Service) ListTransactions(ctx context.Context, q TransactionQuery) ([]domain.Transaction, *TransactionCursor, error) {
	limit := q.Limit
	q.Limit = limit + 1
	rows, err := s.repo.ListTransactions(ctx, q)
	if err != nil {
		return nil, nil, err
	}
	if len(rows) <= limit {
		return rows, nil, nil
	}
	rows = rows[:limit]
	last := rows[len(rows)-1]
	return rows, &TransactionCursor{Date: last.Date, ID: last.ID}, nil
}

// validate applies settings defaults and checks references before the domain rules.
func (s *Service) validate(ctx context.Context, r Repository, t domain.Transaction) (domain.Transaction, map[uuid.UUID]domain.Account, error) {
	if t.BalancingCurrency == "" {
		settings, err := r.Settings(ctx, t.UserID)
		if err != nil {
			return domain.Transaction{}, nil, err
		}
		t.BalancingCurrency = settings.BaseCurrency
	}
	accounts, err := s.references(ctx, r, t)
	if err != nil {
		return domain.Transaction{}, nil, err
	}
	valid, err := domain.NewTransaction(t, accounts)
	return valid, accounts, err
}

// addAccounts loads into accounts the accounts of ts it does not hold yet.
func (s *Service) addAccounts(ctx context.Context, r Repository, userID int64, accounts map[uuid.UUID]domain.Account, ts ...domain.Transaction) error {
	var missing []uuid.UUID
	for _, id := range postingAccounts(ts...) {
		if _, ok := accounts[id]; !ok {
			missing = append(missing, id)
		}
	}
	if len(missing) == 0 {
		return nil
	}
	more, err := r.Accounts(ctx, userID, missing)
	if err != nil {
		return err
	}
	maps.Copy(accounts, more)
	return nil
}

// references loads the accounts of t and checks its payee and link targets.
func (s *Service) references(ctx context.Context, r Repository, t domain.Transaction) (map[uuid.UUID]domain.Account, error) {
	ids := make([]uuid.UUID, 0, len(t.Postings))
	for _, p := range t.Postings {
		ids = append(ids, p.AccountID)
	}
	accounts, err := r.Accounts(ctx, t.UserID, ids)
	if err != nil {
		return nil, err
	}
	for i, p := range t.Postings {
		a, ok := accounts[p.AccountID]
		if !ok || !a.IsBalance() {
			continue
		}
		parent, err := r.AccountHasChildren(ctx, t.UserID, a.ID)
		if err != nil {
			return nil, err
		}
		if parent {
			return nil, &domain.FieldError{Field: "postings[" + strconv.Itoa(i) + "].account_id", Message: "postings go to the sub-accounts of a parent account", Err: domain.ErrValidation}
		}
	}
	if t.PayeeID != uuid.Nil {
		if _, err := r.Payee(ctx, t.UserID, t.PayeeID); errors.Is(err, ErrNotFound) {
			return nil, &domain.FieldError{Field: "payee_id", Message: "unknown payee", Err: domain.ErrValidation}
		} else if err != nil {
			return nil, err
		}
	}
	for i, l := range t.Links {
		if _, err := r.Transaction(ctx, t.UserID, l.Target); errors.Is(err, ErrNotFound) {
			return nil, &domain.FieldError{Field: "links[" + strconv.Itoa(i) + "].target", Message: "unknown transaction", Err: domain.ErrValidation}
		} else if err != nil {
			return nil, err
		}
	}
	return accounts, nil
}
