package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (r *Repository) InsertPlan(ctx context.Context, p domain.InstallmentPlan) error {
	return r.q.InsertInstallmentPlan(ctx, InsertInstallmentPlanParams{
		ID:                  p.ID,
		BooksID:             p.BooksID,
		AccountID:           p.AccountID,
		OriginTransactionID: p.OriginTransactionID,
		PlanKind:            p.Kind,
		//nolint:gosec // at most 420 installments.
		InstallmentCount: int16(p.Count),
		Principal:        p.Principal.Amount(),
		Interest:         p.Interest.Amount(),
		FirstStatementID: p.FirstStatementID,
	})
}

func (r *Repository) PriorInstallments(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	month domain.ReferenceMonth,
) ([]app.PriorInstallment, error) {
	rows, err := r.q.PriorInstallments(
		ctx,
		PriorInstallmentsParams{
			BooksID:        booksID,
			AccountID:      accountID,
			ReferenceMonth: month.FirstDay(),
		},
	)
	if err != nil {
		return nil, err
	}

	out := make([]app.PriorInstallment, 0, len(rows))
	for _, row := range rows {
		in := app.PriorInstallment{
			TransactionID: row.TransactionID,
			Description:   row.Description,
			Count:         int(row.InstallmentCount),
			Amount:        row.Amount,
		}
		if row.InstallmentNumber != nil {
			in.Number = int(*row.InstallmentNumber)
		}

		out = append(out, in)
	}

	return out, nil
}

func (r *Repository) CommittedInstallments(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	month domain.ReferenceMonth,
	today time.Time,
) (int64, error) {
	return r.q.CommittedInstallments(
		ctx,
		CommittedInstallmentsParams{
			BooksID:        booksID,
			AccountID:      accountID,
			ReferenceMonth: month.FirstDay(),
			Today:          today,
		},
	)
}

func (r *Repository) Plan(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (domain.InstallmentPlan, error) {
	row, err := r.q.GetPlan(ctx, GetPlanParams{BooksID: booksID, ID: id})
	if err != nil {
		return domain.InstallmentPlan{}, notFound(err)
	}

	card, err := r.Account(ctx, booksID, row.AccountID)
	if err != nil {
		return domain.InstallmentPlan{}, err
	}

	principal, err := money.New(row.Principal, card.Instrument)
	if err != nil {
		return domain.InstallmentPlan{}, err
	}

	interest, err := money.New(row.Interest, card.Instrument)
	if err != nil {
		return domain.InstallmentPlan{}, err
	}

	return domain.InstallmentPlan{
		ID:                  row.ID,
		BooksID:             row.BooksID,
		AccountID:           row.AccountID,
		OriginTransactionID: row.OriginTransactionID,
		Kind:                row.PlanKind,
		Count:               int(row.InstallmentCount),
		Principal:           principal,
		Interest:            interest,
		FirstStatementID:    row.FirstStatementID,
	}, nil
}

func (r *Repository) PlanState(
	ctx context.Context,
	booksID int64,
	originID uuid.UUID,
) (cancelled, anticipated bool, err error) {
	row, err := r.q.PlanState(ctx, PlanStateParams{BooksID: booksID, OriginID: originID})
	if err != nil {
		return false, false, err
	}

	return row.Cancelled, row.Anticipated, nil
}

func (r *Repository) AnticipatedReferences(
	ctx context.Context,
	booksID int64,
	originID uuid.UUID,
) (map[domain.ReferenceMonth]struct{}, error) {
	rows, err := r.q.AnticipatedReferences(
		ctx,
		AnticipatedReferencesParams{BooksID: booksID, OriginID: originID},
	)
	if err != nil {
		return nil, err
	}

	out := make(map[domain.ReferenceMonth]struct{}, len(rows))
	for _, row := range rows {
		out[domain.MonthOf(row)] = struct{}{}
	}

	return out, nil
}

func (r *Repository) AnticipationCharges(
	ctx context.Context,
	booksID int64,
	originID uuid.UUID,
) ([]app.PlanInstallment, error) {
	rows, err := r.q.ListAnticipationCharges(
		ctx,
		ListAnticipationChargesParams{BooksID: booksID, OriginID: originID},
	)
	if err != nil {
		return nil, err
	}

	out := make([]app.PlanInstallment, len(rows))
	for i, row := range rows {
		out[i] = app.PlanInstallment{
			Amount:    row.Amount,
			Reference: domain.MonthOf(row.ReferenceMonth),
			Closing:   row.ClosingDate,
		}
	}

	return out, nil
}

func (r *Repository) AnticipationDiscount(
	ctx context.Context,
	booksID int64,
	originID uuid.UUID,
) (int64, error) {
	return r.q.AnticipationDiscount(
		ctx,
		AnticipationDiscountParams{BooksID: booksID, OriginID: originID},
	)
}

func (r *Repository) PlanInstallments(
	ctx context.Context,
	booksID int64,
	planID uuid.UUID,
) ([]app.PlanInstallment, error) {
	rows, err := r.q.ListPlanInstallments(
		ctx,
		ListPlanInstallmentsParams{BooksID: booksID, InstallmentPlanID: nullUUID(planID)},
	)
	if err != nil {
		return nil, err
	}

	out := make([]app.PlanInstallment, len(rows))
	for i, row := range rows {
		number := 0
		if row.InstallmentNumber != nil {
			number = int(*row.InstallmentNumber)
		}

		out[i] = app.PlanInstallment{
			Number:    number,
			Amount:    row.Amount,
			Reference: domain.MonthOf(row.ReferenceMonth),
			Closing:   row.ClosingDate,
		}
	}

	return out, nil
}
