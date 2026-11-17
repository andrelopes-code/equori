package postgres

import (
	"context"
	"fmt"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
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
//
//nolint:gosec // limit is at most page.MaxLimit
func rowLimit(limit int) int32 { return int32(limit + 1) }

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
	return app.Institution{
		ID:      row.ID,
		BooksID: row.BooksID,
		Name:    row.Name,
		Code:    deref(row.Code),
		Identifier: app.InstitutionIdentifier{
			Scheme: deref(row.IdentifierScheme),
			Value:  deref(row.Identifier),
		},
	}
}

func toPayee(row LedgerPayee) app.Payee {
	return app.Payee{
		ID:         row.ID,
		BooksID:    row.BooksID,
		Name:       row.Name,
		MergedInto: row.MergedInto.UUID,
	}
}

func toAccount(row LedgerAccount) domain.Account {
	return domain.Account{
		ID:                    row.ID,
		BooksID:               row.BooksID,
		Name:                  row.Name,
		Class:                 domain.Class(row.AccountClass),
		Kind:                  domain.Kind(deref(row.Kind)),
		Instrument:            money.Currency(row.Instrument),
		ParentID:              row.ParentID.UUID,
		InstitutionID:         row.InstitutionID.UUID,
		CounterpartyID:        row.CounterpartyPayeeID.UUID,
		OpenedOn:              row.OpenedOn,
		ClosedOn:              row.ClosedOn,
		YieldMode:             domain.YieldMode(row.YieldMode),
		ExcludedFromLiquidity: row.ExcludedFromLiquidity,
		SystemRole: domain.SystemRole(
			deref(row.SystemRole),
		),
		Color: colorOf(row.Color),
		Icon:  deref(row.Icon),
		Face: domain.CardFace{
			Color:       deref(row.FaceColor),
			Art:         deref(row.FaceArt),
			Chip:        deref(row.FaceChip),
			Orientation: deref(row.FaceOrientation),
			Brand:       deref(row.FaceBrand),
		},
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

	//nolint:gosec // NewAccount keeps the colour in 1..8.
	v := int16(c)

	return &v
}

func toTransaction(row LedgerTransaction) domain.Transaction {
	return domain.Transaction{
		ID:                row.ID,
		BooksID:           row.BooksID,
		Date:              row.Date,
		Description:       row.Description,
		PayeeID:           row.PayeeID.UUID,
		BalancingCurrency: money.Currency(row.BalancingCurrency),
		Origin:            domain.Origin(row.Origin),
		Version:           int(row.Version),
		VoidedAt:          row.VoidedAt,
		VoidReason:        deref(row.VoidReason),
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
		ID:               row.ID,
		AccountID:        row.AccountID,
		Amount:           amount,
		Weight:           weight,
		Status:           domain.PostingStatus(row.Status),
		SettledOn:        row.SettledOn,
		Memo:             deref(row.Memo),
		StatementID:      row.StatementID.UUID,
		StatementBasis:   row.StatementBasis,
		CardRole:         deref(row.CardRole),
		ExternalRecordID: row.ExternalRecordID.UUID,
	}
	if row.StatementReference != nil {
		m := domain.MonthOf(*row.StatementReference)
		p.Statement = &m
	}

	if row.InstallmentPlanID.Valid && row.InstallmentNumber != nil && row.InstallmentCount != nil {
		p.Installment = &domain.InstallmentRef{
			PlanID: row.InstallmentPlanID.UUID,
			Number: int(*row.InstallmentNumber),
			Count:  int(*row.InstallmentCount),
		}
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

func toBillingRule(row LedgerBillingCycleRule) domain.BillingCycleRule {
	r := domain.BillingCycleRule{
		EffectiveFrom:     domain.MonthOf(row.EffectiveFrom),
		DueDay:            int(row.DueDay),
		Assignment:        row.ClosingDayAssignment,
		Adjustment:        row.DueDateAdjustment,
		Calendar:          row.Calendar,
		ClosingMode:       row.ClosingMode,
		ClosingAdjustment: row.ClosingAdjustment,
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
	return domain.Card{
		ID:              row.ID,
		BooksID:         row.BooksID,
		AccountID:       row.AccountID,
		Holder:          row.Holder,
		LastFour:        row.LastFour,
		Virtual:         row.Virtual,
		Active:          row.Active,
		ForeignChargeBP: int(row.ForeignChargeBp),
		Network:         deref(row.Network),
	}
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

	//nolint:gosec // at most 420 installments.
	n := int16(i.Number)

	return &n
}

func installmentCount(i *domain.InstallmentRef) *int16 {
	if i == nil {
		return nil
	}

	//nolint:gosec // at most 420 installments.
	n := int16(i.Count)

	return &n
}
