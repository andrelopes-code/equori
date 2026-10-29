package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func toStatementAPI(v app.StatementView, currency money.Currency) StatementSummary {
	m := func(amount int64) Money { return Money{Amount: amount, Currency: string(currency)} }
	out := StatementSummary{
		Id: v.ID, AccountId: v.AccountID, Reference: v.Input.Reference.String(),
		ClosingDate: apiDate(v.Input.Closing), DueDate: apiDate(v.Input.Due),
		Opening: m(v.Summary.Opening), Charges: m(v.Summary.Charges), Credits: m(v.Summary.Credits), AmountDue: m(v.Summary.AmountDue),
		Payments: m(v.Summary.Payments), Unpaid: m(v.Summary.Unpaid), Status: StatementSummaryStatus(v.Summary.Status),
		Reconciled: v.Reconciled, Settled: m(v.Summary.Settled), PriorCredits: m(v.Summary.PriorCredits),
		EarlyPayments: m(v.Summary.EarlyPayments), BilledAmount: m(v.Summary.BilledAmount),
		OpenAmount: m(v.Summary.OpenAmount),
	}
	if f := v.Fact; f != nil {
		fact := StatementFact{Source: StatementFactSource(f.Source), ClosingDate: apiOptDate(f.Closing), DueDate: apiDate(f.Due), Total: m(f.Total)}
		if f.Minimum != nil {
			minimum := m(*f.Minimum)
			fact.Minimum = &minimum
		}
		difference := m(v.Summary.AmountDue - f.Total)
		out.Institution, out.AmountDifference = &fact, &difference
	}
	return out
}

func (s *Server) SetStatementFacts(ctx context.Context, req SetStatementFactsRequestObject) (SetStatementFactsResponseObject, error) {
	total, err := fromMoneyAPI("total", req.Body.Total)
	if err != nil {
		return nil, err
	}
	f := app.StatementFacts{Closing: optDate(req.Body.ClosingDate), Due: dateOf(req.Body.DueDate), Total: total}
	if req.Body.Minimum != nil {
		minimum, err := fromMoneyAPI("minimum", *req.Body.Minimum)
		if err != nil {
			return nil, err
		}
		f.Minimum = &minimum
	}
	userID := auth.MustUserID(ctx)
	if err := s.svc.SetOwnerFacts(ctx, userID, req.Id, f); err != nil {
		return nil, err
	}
	out, err := s.statementDetail(ctx, userID, req.Id)
	if err != nil {
		return nil, err
	}
	return SetStatementFacts200JSONResponse(out), nil
}

func (s *Server) RemoveStatementFacts(ctx context.Context, req RemoveStatementFactsRequestObject) (RemoveStatementFactsResponseObject, error) {
	if err := s.svc.RemoveOwnerFacts(ctx, auth.MustUserID(ctx), req.Id); err != nil {
		return nil, err
	}
	return RemoveStatementFacts204Response{}, nil
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
	p, err := listPage[app.StatementKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	views, next, a, err := s.svc.Statements(ctx, auth.MustUserID(ctx), req.Id, from, to, p)
	if err != nil {
		return nil, err
	}
	out := ListStatements200JSONResponse{Items: make([]StatementSummary, len(views))}
	for i, v := range views {
		out.Items[i] = toStatementAPI(v, a.Instrument)
	}
	out.NextCursor, err = page.Next(next)
	return out, err
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
		DueDate: summary.DueDate, Opening: summary.Opening, Charges: summary.Charges,
		Credits: summary.Credits, AmountDue: summary.AmountDue, Payments: summary.Payments, Unpaid: summary.Unpaid,
		Status: StatementDetailStatus(summary.Status), Reconciled: summary.Reconciled, Postings: make([]StatementPosting, len(postings)),
		Settled: summary.Settled, PriorCredits: summary.PriorCredits, EarlyPayments: summary.EarlyPayments,
		BilledAmount: summary.BilledAmount, Institution: summary.Institution, AmountDifference: summary.AmountDifference,
		OpenAmount: summary.OpenAmount,
	}
	if e := v.Explanation; e.Move != nil {
		out.DifferenceProposal = &DifferenceProposal{TransactionIds: e.Move, Amount: *summary.AmountDifference}
	}
	if v.Explanation.Rounding {
		out.RoundingDifference = new(true)
	}
	for i, p := range postings {
		sp := StatementPosting{
			TransactionId: p.TransactionID, Date: apiDate(p.Date), Description: p.Description,
			CardRole: StatementPostingCardRole(p.CardRole), Amount: Money{Amount: p.Amount, Currency: string(a.Instrument)},
			Provisional: p.Provisional,
		}
		if p.Installment != nil {
			sp.Installment = &Installment{PlanId: p.Installment.PlanID, Number: p.Installment.Number, Count: p.Installment.Count}
		}
		out.Postings[i] = sp
	}
	return out, nil
}
