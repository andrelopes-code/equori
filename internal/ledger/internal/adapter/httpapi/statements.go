package httpapi

import (
	"github.com/google/uuid"

	"context"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func toStatementAPI(v app.StatementView, currency money.Currency) StatementSummary {
	return StatementSummary{
		Id: v.ID, AccountId: v.AccountID, Reference: v.Input.Reference.String(),
		ClosingDate: apiDate(v.Input.Closing), DueDate: apiDate(v.Input.Due), Currency: string(currency),
		Opening: v.Summary.Opening, Charges: v.Summary.Charges, Credits: v.Summary.Credits, AmountDue: v.Summary.AmountDue,
		Payments: v.Summary.Payments, Unpaid: v.Summary.Unpaid, Status: StatementSummaryStatus(v.Summary.Status),
	}
}

func optMonth(field string, s *string) (*domain.ReferenceMonth, error) {
	if s == nil {
		return nil, nil
	}
	m, err := domain.ParseReferenceMonth(*s)
	if err != nil {
		return nil, &domain.FieldError{Field: field, Message: "must be YYYY-MM", Err: domain.ErrValidation}
	}
	return &m, nil
}

func (s *Server) ListStatements(ctx context.Context, req ListStatementsRequestObject) (ListStatementsResponseObject, error) {
	from, err := optMonth("from", req.Params.From)
	if err != nil {
		return nil, err
	}
	to, err := optMonth("to", req.Params.To)
	if err != nil {
		return nil, err
	}
	views, a, err := s.svc.Statements(ctx, auth.MustUserID(ctx), req.Id, from, to)
	if err != nil {
		return nil, err
	}
	out := ListStatements200JSONResponse{Items: make([]StatementSummary, len(views))}
	for i, v := range views {
		out.Items[i] = toStatementAPI(v, a.Instrument)
	}
	return out, nil
}

func (s *Server) GetStatement(ctx context.Context, req GetStatementRequestObject) (GetStatementResponseObject, error) {
	out, err := s.statementDetail(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	return GetStatement200JSONResponse(out), nil
}

func (s *Server) statementDetail(ctx context.Context, userID int64, id uuid.UUID) (StatementDetail, error) {
	v, a, postings, err := s.svc.Statement(ctx, userID, id)
	if err != nil {
		return StatementDetail{}, err
	}
	summary := toStatementAPI(v, a.Instrument)
	out := StatementDetail{
		Id: summary.Id, AccountId: summary.AccountId, Reference: summary.Reference, ClosingDate: summary.ClosingDate,
		DueDate: summary.DueDate, Currency: summary.Currency, Opening: summary.Opening, Charges: summary.Charges,
		Credits: summary.Credits, AmountDue: summary.AmountDue, Payments: summary.Payments, Unpaid: summary.Unpaid,
		Status: StatementDetailStatus(summary.Status), Postings: make([]StatementPosting, len(postings)),
	}
	for i, p := range postings {
		sp := StatementPosting{
			TransactionId: p.TransactionID, Date: apiDate(p.Date), Description: p.Description,
			CardRole: StatementPostingCardRole(p.CardRole), Amount: Money{Amount: p.Amount, Currency: string(a.Instrument)},
		}
		if p.Installment != nil {
			sp.Installment = &Installment{PlanId: p.Installment.PlanID, Number: p.Installment.Number, Count: p.Installment.Count}
		}
		out.Postings[i] = sp
	}
	return out, nil
}
