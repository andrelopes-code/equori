package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func mapAll[R, T any](rows []R, f func(R) T) []T {
	out := make([]T, len(rows))
	for i, r := range rows {
		out[i] = f(r)
	}
	return out
}

// pageOf keeps the first limit of the limit+1 rows a keyset query fetched and returns the
// key of the last kept row when more rows follow (ADR 005, section 4).
func pageOf[R, T, K any](rows []R, limit int, item func(R) T, key func(R) K) ([]T, *K) {
	kept, more := page.Trim(rows, limit)
	out := mapAll(kept, item)
	if !more {
		return out, nil
	}
	k := key(kept[len(kept)-1])
	return out, &k
}

// rowLimit is the LIMIT of a keyset query: one row more than the page, to detect a next page.
func rowLimit(limit int) int32 { return int32(limit + 1) } //nolint:gosec // limit is at most page.MaxLimit

func nullString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func nullUUID(id uuid.UUID) uuid.NullUUID {
	return uuid.NullUUID{UUID: id, Valid: id != uuid.Nil}
}

func originalAmount(m *money.Money) *int64 {
	if m == nil {
		return nil
	}
	a := m.Amount()
	return &a
}

func originalInstrument(m *money.Money) *string {
	if m == nil {
		return nil
	}
	c := string(m.Currency())
	return &c
}

func toInstitution(row LedgerInstitution) app.Institution {
	return app.Institution{ID: row.ID, UserID: row.UserID, Name: row.Name, Code: deref(row.Code), Identifier: app.InstitutionIdentifier{Scheme: deref(row.IdentifierScheme), Value: deref(row.Identifier)}}
}

func toPayee(row LedgerPayee) app.Payee {
	return app.Payee{ID: row.ID, UserID: row.UserID, Name: row.Name, MergedInto: row.MergedInto.UUID}
}

func toAccount(row LedgerAccount) domain.Account {
	return domain.Account{
		ID: row.ID, UserID: row.UserID, Name: row.Name, Class: domain.Class(row.AccountClass),
		Kind: domain.Kind(deref(row.Kind)), Instrument: money.Currency(row.Instrument),
		ParentID: row.ParentID.UUID, InstitutionID: row.InstitutionID.UUID, CounterpartyID: row.CounterpartyPayeeID.UUID,
		OpenedOn: row.OpenedOn, ClosedOn: row.ClosedOn, YieldMode: domain.YieldMode(row.YieldMode),
		SystemRole: domain.SystemRole(deref(row.SystemRole)), Color: colorOf(row.Color), Icon: deref(row.Icon),
	}
}

func colorOf(c *int16) int {
	if c == nil {
		return 0
	}
	return int(*c)
}

// nullColor stores the absent colour 0 as NULL (A83).
func nullColor(c int) *int16 {
	if c == 0 {
		return nil
	}
	v := int16(c) //nolint:gosec // NewAccount keeps the colour in 1..8.
	return &v
}

func toTransaction(row LedgerTransaction) domain.Transaction {
	return domain.Transaction{
		ID: row.ID, UserID: row.UserID, Date: row.Date, Description: row.Description, PayeeID: row.PayeeID.UUID,
		BalancingCurrency: money.Currency(row.BalancingCurrency), Origin: domain.Origin(row.Origin),
		Version: int(row.Version), VoidedAt: row.VoidedAt, VoidReason: deref(row.VoidReason),
	}
}

func (r *Repository) toPosting(ctx context.Context, row ListPostingsRow) (domain.Posting, error) {
	amount, err := app.AmountOf(ctx, r.ins, row.Amount, money.Currency(row.AccountInstrument))
	if err != nil {
		return domain.Posting{}, fmt.Errorf("posting %s amount: %w", row.ID, err)
	}
	weight, err := money.New(row.Weight, money.Currency(row.BalancingCurrency))
	if err != nil {
		return domain.Posting{}, fmt.Errorf("posting %s weight: %w", row.ID, err)
	}
	p := domain.Posting{
		ID: row.ID, AccountID: row.AccountID, Amount: amount, Weight: weight,
		Status: domain.PostingStatus(row.Status), SettledOn: row.SettledOn, Memo: deref(row.Memo),
		StatementID: row.StatementID.UUID, CardRole: deref(row.CardRole), ExternalRecordID: row.ExternalRecordID.UUID,
	}
	if row.StatementReference != nil {
		m := domain.MonthOf(*row.StatementReference)
		p.Statement = &m
	}
	if row.InstallmentPlanID.Valid && row.InstallmentNumber != nil && row.InstallmentCount != nil {
		p.Installment = &domain.InstallmentRef{PlanID: row.InstallmentPlanID.UUID, Number: int(*row.InstallmentNumber), Count: int(*row.InstallmentCount)}
	}
	if row.OriginalAmount != nil && row.OriginalInstrument != nil {
		orig, err := money.New(*row.OriginalAmount, money.Currency(*row.OriginalInstrument))
		if err != nil {
			return domain.Posting{}, fmt.Errorf("posting %s original amount: %w", row.ID, err)
		}
		p.Original = &orig
	}
	return p, nil
}

// snapshot is the JSON form of a replaced transaction version (ledger_transaction_version).
type snapshot struct {
	ID                uuid.UUID         `json:"id"`
	UserID            int64             `json:"user_id"`
	Date              string            `json:"date"`
	Description       string            `json:"description"`
	PayeeID           uuid.UUID         `json:"payee_id"`
	BalancingCurrency string            `json:"balancing_currency"`
	Origin            string            `json:"origin"`
	Version           int               `json:"version"`
	Tags              []string          `json:"tags"`
	Links             []snapshotLink    `json:"links"`
	Postings          []snapshotPosting `json:"postings"`
}

type snapshotLink struct {
	Type   string    `json:"type"`
	Target uuid.UUID `json:"target"`
	Amount int64     `json:"amount,omitempty"`
}

type snapshotPosting struct {
	AccountID          uuid.UUID              `json:"account_id"`
	Amount             int64                  `json:"amount"`
	Currency           string                 `json:"currency"`
	Weight             int64                  `json:"weight"`
	Status             string                 `json:"status"`
	SettledOn          string                 `json:"settled_on,omitempty"`
	OriginalAmount     *int64                 `json:"original_amount,omitempty"`
	OriginalInstrument *string                `json:"original_instrument,omitempty"`
	Memo               string                 `json:"memo,omitempty"`
	Statement          string                 `json:"statement,omitempty"`
	StatementID        uuid.UUID              `json:"statement_id,omitzero"`
	CardRole           string                 `json:"card_role,omitempty"`
	Installment        *domain.InstallmentRef `json:"installment,omitempty"`
}

func toSnapshot(t domain.Transaction) snapshot {
	s := snapshot{
		ID: t.ID, UserID: t.UserID, Date: t.Date.Format(time.DateOnly), Description: t.Description, PayeeID: t.PayeeID,
		BalancingCurrency: string(t.BalancingCurrency), Origin: string(t.Origin), Version: t.Version, Tags: t.Tags,
	}
	for _, l := range t.Links {
		s.Links = append(s.Links, snapshotLink{Type: string(l.Type), Target: l.Target, Amount: l.Amount})
	}
	for _, p := range t.Postings {
		sp := snapshotPosting{
			AccountID: p.AccountID, Amount: p.Amount.Amount(), Currency: string(p.Amount.Currency()), Weight: p.Weight.Amount(),
			Status: string(p.Status), OriginalAmount: originalAmount(p.Original), OriginalInstrument: originalInstrument(p.Original), Memo: p.Memo,
		}
		if p.SettledOn != nil {
			sp.SettledOn = p.SettledOn.Format(time.DateOnly)
		}
		if p.Statement != nil {
			sp.Statement = p.Statement.String()
		}
		sp.StatementID, sp.CardRole, sp.Installment = p.StatementID, p.CardRole, p.Installment
		s.Postings = append(s.Postings, sp)
	}
	return s
}

func (s snapshot) transaction(ctx context.Context, ins app.Instruments) (domain.Transaction, error) {
	d, err := time.Parse(time.DateOnly, s.Date)
	if err != nil {
		return domain.Transaction{}, err
	}
	t := domain.Transaction{
		ID: s.ID, UserID: s.UserID, Date: d, Description: s.Description, PayeeID: s.PayeeID,
		BalancingCurrency: money.Currency(s.BalancingCurrency), Origin: domain.Origin(s.Origin), Version: s.Version, Tags: s.Tags,
	}
	for _, l := range s.Links {
		t.Links = append(t.Links, domain.Link{Type: domain.LinkType(l.Type), Target: l.Target, Amount: l.Amount})
	}
	for _, sp := range s.Postings {
		amount, err := app.AmountOf(ctx, ins, sp.Amount, money.Currency(sp.Currency))
		if err != nil {
			return domain.Transaction{}, err
		}
		weight, err := money.New(sp.Weight, t.BalancingCurrency)
		if err != nil {
			return domain.Transaction{}, err
		}
		p := domain.Posting{
			AccountID: sp.AccountID, Amount: amount, Weight: weight, Status: domain.PostingStatus(sp.Status), Memo: sp.Memo,
			StatementID: sp.StatementID, CardRole: sp.CardRole, Installment: sp.Installment,
		}
		if sp.Statement != "" {
			m, err := domain.ParseReferenceMonth(sp.Statement)
			if err != nil {
				return domain.Transaction{}, err
			}
			p.Statement = &m
		}
		if sp.SettledOn != "" {
			settled, err := time.Parse(time.DateOnly, sp.SettledOn)
			if err != nil {
				return domain.Transaction{}, err
			}
			p.SettledOn = &settled
		}
		if sp.OriginalAmount != nil && sp.OriginalInstrument != nil {
			orig, err := money.New(*sp.OriginalAmount, money.Currency(*sp.OriginalInstrument))
			if err != nil {
				return domain.Transaction{}, err
			}
			p.Original = &orig
		}
		t.Postings = append(t.Postings, p)
	}
	return t, nil
}

func toBillingRule(row LedgerBillingCycleRule) domain.BillingCycleRule {
	r := domain.BillingCycleRule{
		EffectiveFrom: domain.MonthOf(row.EffectiveFrom), DueDay: int(row.DueDay),
		Assignment: row.ClosingDayAssignment, Adjustment: row.DueDateAdjustment, Calendar: row.Calendar,
		ClosingMode: row.ClosingMode, ClosingAdjustment: row.ClosingAdjustment,
	}
	if row.ClosingDay != nil {
		r.ClosingDay = int(*row.ClosingDay)
	}
	if row.ClosingDaysBeforeDue != nil {
		r.ClosingDaysBeforeDue = int(*row.ClosingDaysBeforeDue)
	}
	return r
}

func toCard(row LedgerCard) domain.Card {
	return domain.Card{ID: row.ID, UserID: row.UserID, AccountID: row.AccountID, Holder: row.Holder, LastFour: row.LastFour, Virtual: row.Virtual, Active: row.Active, ForeignChargeBP: int(row.ForeignChargeBp)}
}

func installmentPlan(i *domain.InstallmentRef) uuid.NullUUID {
	if i == nil {
		return uuid.NullUUID{}
	}
	return nullUUID(i.PlanID)
}

func installmentNumber(i *domain.InstallmentRef) *int16 {
	if i == nil {
		return nil
	}
	n := int16(i.Number) //nolint:gosec // at most 420 installments.
	return &n
}

func installmentCount(i *domain.InstallmentRef) *int16 {
	if i == nil {
		return nil
	}
	n := int16(i.Count) //nolint:gosec // at most 420 installments.
	return &n
}
