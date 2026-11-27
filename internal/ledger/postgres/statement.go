package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
)

func (r *Repository) EnsureStatement(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	d domain.StatementDates,
	due time.Time,
) (uuid.UUID, error) {
	return r.q.EnsureStatement(ctx, EnsureStatementParams{
		BooksID:        booksID,
		AccountID:      accountID,
		ReferenceMonth: d.Reference.FirstDay(),
		ClosingDate:    d.Closing,
		DueDate:        due,
	})
}

func (r *Repository) Statements(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) ([]app.Statement, error) {
	rows, err := r.q.ListStatements(
		ctx,
		ListStatementsParams{BooksID: booksID, AccountID: accountID},
	)
	if err != nil {
		return nil, err
	}

	lines, err := r.q.ListStatementLines(
		ctx,
		ListStatementLinesParams{BooksID: booksID, AccountID: accountID},
	)
	if err != nil {
		return nil, err
	}

	factRows, err := r.q.ListStatementFacts(
		ctx,
		ListStatementFactsParams{BooksID: booksID, AccountID: accountID},
	)
	if err != nil {
		return nil, err
	}

	facts := statementFactsByID(factRows)
	byStatement := statementLinesByID(lines)

	out := make([]app.Statement, len(rows))
	for i, row := range rows {
		out[i] = app.Statement{
			ID:         row.ID,
			AccountID:  row.AccountID,
			FinancedBy: row.FinancedByPlanID.UUID,
			Reconciled: row.Reconciled,
			Input: domain.StatementInput{
				Reference: domain.MonthOf(
					row.ReferenceMonth,
				),
				Closing:  row.ClosingDate,
				Due:      row.DueDate,
				Lines:    byStatement[row.ID],
				Financed: row.FinancedByPlanID.Valid,
			},
			Fact: domain.EffectiveFact(facts[row.ID]),
		}
	}

	return out, nil
}

func statementFactsByID(factRows []LedgerStatementFact) map[uuid.UUID][]domain.StatementFact {
	facts := make(map[uuid.UUID][]domain.StatementFact)
	for _, f := range factRows {
		facts[f.StatementID] = append(facts[f.StatementID], domain.StatementFact{
			BooksID:     f.BooksID,
			StatementID: f.StatementID,
			Source:      f.Source,
			Closing:     f.ClosingDate,
			Due:         f.DueDate,
			Total:       f.Total,
			Minimum:     f.Minimum,
		})
	}

	return facts
}

func statementLinesByID(lines []ListStatementLinesRow) map[uuid.UUID][]domain.StatementLine {
	byStatement := make(map[uuid.UUID][]domain.StatementLine)
	for _, l := range lines {
		byStatement[l.StatementID.UUID] = append(
			byStatement[l.StatementID.UUID],
			domain.StatementLine{
				Role: deref(l.CardRole), Amount: l.Amount, Date: l.BookedOn, Confirmed: l.Confirmed,
			},
		)
	}

	return byStatement
}

func (r *Repository) HasOpeningBalance(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) (bool, error) {
	return r.q.HasOpeningBalance(
		ctx,
		HasOpeningBalanceParams{BooksID: booksID, AccountID: accountID},
	)
}

func (r *Repository) StatementClosings(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) (map[domain.ReferenceMonth]time.Time, error) {
	rows, err := r.q.ListStatementClosings(
		ctx,
		ListStatementClosingsParams{BooksID: booksID, AccountID: accountID},
	)

	out := make(map[domain.ReferenceMonth]time.Time, len(rows))
	for _, row := range rows {
		out[domain.MonthOf(row.ReferenceMonth)] = row.ClosingDate
	}

	return out, err
}

func (r *Repository) SaveStatementFact(ctx context.Context, f domain.StatementFact) error {
	return r.q.UpsertStatementFact(ctx, UpsertStatementFactParams{
		BooksID:     f.BooksID,
		StatementID: f.StatementID,
		Source:      f.Source,
		ClosingDate: f.Closing,
		DueDate:     f.Due,
		Total:       f.Total,
		Minimum:     f.Minimum,
	})
}

func (r *Repository) DeleteStatementFact(
	ctx context.Context,
	booksID int64,
	statementID uuid.UUID,
	source string,
) error {
	return r.q.DeleteStatementFact(
		ctx,
		DeleteStatementFactParams{BooksID: booksID, StatementID: statementID, Source: source},
	)
}

func (r *Repository) RedatablePostings(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
) ([]app.RedatablePosting, error) {
	rows, err := r.q.ListRedatablePostings(
		ctx,
		ListRedatablePostingsParams{BooksID: booksID, AccountID: accountID},
	)

	out := make([]app.RedatablePosting, len(rows))
	for i, row := range rows {
		out[i] = app.RedatablePosting{ID: row.ID, Date: row.BookedOn, StatementID: row.StatementID}
	}

	return out, err
}

func (r *Repository) MovePostingStatement(
	ctx context.Context,
	booksID int64,
	postingID, statementID uuid.UUID,
) error {
	return r.q.MovePostingStatement(
		ctx,
		MovePostingStatementParams{
			BooksID:     booksID,
			ID:          postingID,
			StatementID: nullUUID(statementID),
		},
	)
}

func (r *Repository) StatementAccount(
	ctx context.Context,
	booksID int64,
	statementID uuid.UUID,
) (uuid.UUID, error) {
	row, err := r.q.GetStatement(ctx, GetStatementParams{BooksID: booksID, ID: statementID})
	if err != nil {
		return uuid.Nil, notFound(err)
	}

	return row.AccountID, nil
}

func (r *Repository) StatementPostings(
	ctx context.Context,
	booksID int64,
	statementID uuid.UUID,
) ([]app.StatementPosting, error) {
	rows, err := r.q.ListStatementPostings(
		ctx,
		ListStatementPostingsParams{BooksID: booksID, StatementID: nullUUID(statementID)},
	)
	if err != nil {
		return nil, err
	}

	out := make([]app.StatementPosting, len(rows))
	for i, row := range rows {
		out[i] = app.StatementPosting{
			TransactionID: row.TransactionID, Date: row.Date, Description: row.Description,
			CardRole: deref(row.CardRole), Amount: row.Amount, Basis: row.StatementBasis,
		}
		if row.InstallmentPlanID.Valid && row.InstallmentNumber != nil &&
			row.InstallmentCount != nil {
			out[i].Installment = &domain.InstallmentRef{
				PlanID: row.InstallmentPlanID.UUID,
				Number: int(*row.InstallmentNumber),
				Count:  int(*row.InstallmentCount),
			}
		}
	}

	return out, nil
}

func (r *Repository) UpdateStatementDates(
	ctx context.Context,
	id uuid.UUID,
	closing, due time.Time,
) error {
	return r.q.UpdateStatementDates(
		ctx,
		UpdateStatementDatesParams{ID: id, ClosingDate: closing, DueDate: due},
	)
}

func (r *Repository) SetStatementFinanced(
	ctx context.Context,
	statementID, planID uuid.UUID,
) error {
	return r.q.SetStatementFinanced(
		ctx,
		SetStatementFinancedParams{ID: statementID, PlanID: nullUUID(planID)},
	)
}
