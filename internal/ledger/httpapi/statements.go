package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func toStatementAPI(v app.StatementView, currency money.Currency) StatementSummary {
	m := func(amount int64) Money { return Money{Amount: amount, Currency: string(currency)} }

	out := StatementSummary{
		Id:          v.ID,
		AccountId:   v.AccountID,
		Reference:   v.Input.Reference.String(),
		ClosingDate: apiDate(v.Input.Closing),
		DueDate:     apiDate(v.Input.Due),
		Opening: m(
			v.Summary.Opening,
		),
		Charges:   m(v.Summary.Charges),
		Credits:   m(v.Summary.Credits),
		AmountDue: m(v.Summary.AmountDue),
		Payments: m(
			v.Summary.Payments,
		),
		Unpaid:        m(v.Summary.Unpaid),
		Status:        StatementSummaryStatus(v.Summary.Status),
		Reconciled:    v.Reconciled,
		Settled:       m(v.Summary.Settled),
		PriorCredits:  m(v.Summary.PriorCredits),
		EarlyPayments: m(v.Summary.EarlyPayments),
		BilledAmount:  m(v.Summary.BilledAmount),
		OpenAmount:    m(v.Summary.OpenAmount),
	}
	if v.Summary.Feed {
		confirmed, awaiting := m(v.Summary.ConfirmedAmount), m(v.Summary.AwaitingAmount)
		out.ConfirmedAmount, out.AwaitingAmount = &confirmed, &awaiting
	}

	if f := v.Fact; f != nil {
		fact := StatementFact{
			Source:      StatementFactSource(f.Source),
			ClosingDate: apiOptDate(f.Closing),
			DueDate:     apiDate(f.Due),
			Total:       m(f.Total),
		}
		if f.Minimum != nil {
			minimum := m(*f.Minimum)
			fact.Minimum = &minimum
		}

		difference := m(v.Summary.AmountDue - f.Total)
		out.Institution, out.AmountDifference = &fact, &difference
	}

	return out
}

func (s *Server) setStatementFacts(
	ctx context.Context,
	r *http.Request,
	in SetStatementFactsJSONRequestBody,
) (StatementDetail, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return StatementDetail{}, err
	}

	total, err := fromMoneyAPI("total", in.Total)
	if err != nil {
		return StatementDetail{}, err
	}

	f := app.StatementFacts{Closing: optDate(in.ClosingDate), Due: dateOf(in.DueDate), Total: total}
	if in.Minimum != nil {
		minimum, err := fromMoneyAPI("minimum", *in.Minimum)
		if err != nil {
			return StatementDetail{}, err
		}

		f.Minimum = &minimum
	}

	booksID := auth.MustBooksID(ctx)
	if err := s.svc.SetOwnerFacts(ctx, booksID, id, f); err != nil {
		return StatementDetail{}, err
	}

	out, err := s.statementDetail(ctx, booksID, id)
	if err != nil {
		return StatementDetail{}, err
	}

	return out, nil
}

func (s *Server) removeStatementFacts(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.RemoveOwnerFacts(ctx, auth.MustBooksID(ctx), id); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func optMonth(field string, s *string) (*domain.ReferenceMonth, error) {
	if s == nil {
		return nil, nil
	}

	m, err := domain.ParseReferenceMonth(*s)
	if err != nil {
		return nil, &domain.FieldError{
			Field:   field,
			Message: "must be YYYY-MM",
			Err:     domain.ErrValidation,
		}
	}

	return &m, nil
}

func (s *Server) listStatements(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (StatementList, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return StatementList{}, err
	}

	params, err := httpserver.Query[ListStatementsParams](r)
	if err != nil {
		return StatementList{}, err
	}

	from, err := optMonth("from", params.From)
	if err != nil {
		return StatementList{}, err
	}

	to, err := optMonth("to", params.To)
	if err != nil {
		return StatementList{}, err
	}

	p, err := listPage[app.StatementKey](params.Limit, params.Cursor)
	if err != nil {
		return StatementList{}, err
	}

	views, next, a, err := s.svc.Statements(ctx, auth.MustBooksID(ctx), id, from, to, p)
	if err != nil {
		return StatementList{}, err
	}

	out := StatementList{Items: make([]StatementSummary, len(views))}
	for i, v := range views {
		out.Items[i] = toStatementAPI(v, a.Instrument)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) getStatement(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (StatementDetail, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return StatementDetail{}, err
	}

	out, err := s.statementDetail(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return StatementDetail{}, err
	}

	return out, nil
}

func (s *Server) statementDetail(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
) (StatementDetail, error) {
	v, a, postings, err := s.svc.Statement(ctx, booksID, id)
	if err != nil {
		return StatementDetail{}, err
	}

	summary := toStatementAPI(v, a.Instrument)

	out := StatementDetail{
		Id:          summary.Id,
		AccountId:   summary.AccountId,
		Reference:   summary.Reference,
		ClosingDate: summary.ClosingDate,
		DueDate:     summary.DueDate,
		Opening:     summary.Opening,
		Charges:     summary.Charges,
		Credits:     summary.Credits,
		AmountDue:   summary.AmountDue,
		Payments:    summary.Payments,
		Unpaid:      summary.Unpaid,
		Status: StatementDetailStatus(
			summary.Status,
		),
		Reconciled:       summary.Reconciled,
		Postings:         make([]StatementPosting, len(postings)),
		Settled:          summary.Settled,
		PriorCredits:     summary.PriorCredits,
		EarlyPayments:    summary.EarlyPayments,
		BilledAmount:     summary.BilledAmount,
		Institution:      summary.Institution,
		AmountDifference: summary.AmountDifference,
		OpenAmount:       summary.OpenAmount,
		ConfirmedAmount:  summary.ConfirmedAmount,
		AwaitingAmount:   summary.AwaitingAmount,
	}
	if e := v.Explanation; e.Move != nil {
		out.DifferenceProposal = &DifferenceProposal{
			TransactionIds: e.Move,
			Amount:         *summary.AmountDifference,
		}
	}

	if v.Explanation.Rounding {
		out.RoundingDifference = new(true)
	}

	for i, p := range postings {
		sp := StatementPosting{
			TransactionId: p.TransactionID,
			Date:          apiDate(p.Date),
			Description:   p.Description,
			CardRole: StatementPostingCardRole(
				p.CardRole,
			),
			Amount:      Money{Amount: p.Amount, Currency: string(a.Instrument)},
			Provisional: p.Provisional,
		}
		if p.Installment != nil {
			sp.Installment = &Installment{
				PlanId: p.Installment.PlanID,
				Number: p.Installment.Number,
				Count:  p.Installment.Count,
			}
		}

		out.Postings[i] = sp
	}

	return out, nil
}
