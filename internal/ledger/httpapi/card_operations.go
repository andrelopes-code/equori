package httpapi

import (
	"context"
	"fmt"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) createInstallmentPurchase(
	ctx context.Context,
	r *http.Request,
	in CreateInstallmentPurchaseJSONRequestBody,
) (InstallmentPurchase, error) {
	input, err := fromInstallmentPurchaseInput(in)
	if err != nil {
		return InstallmentPurchase{}, err
	}

	t, planID, err := s.svc.InstallmentPurchase(ctx, auth.MustBooksID(ctx), input)
	if err != nil {
		return InstallmentPurchase{}, err
	}

	return InstallmentPurchase{Transaction: toTransactionAPI(t), PlanId: planID}, nil
}

func fromInstallmentPurchaseInput(b InstallmentPurchaseInput) (app.InstallmentPurchaseInput, error) {
	in := app.InstallmentPurchaseInput{
		CardAccountID: b.CardAccountId, Date: dateOf(b.Date), Description: optString(b.Description),
		PayeeID: optUUID(b.PayeeId), Count: b.InstallmentCount,
	}
	if b.Tags != nil {
		in.Tags = *b.Tags
	}

	for i, sp := range b.Splits {
		amount, err := fromMoneyAPI(fmt.Sprintf("splits[%d].amount", i), sp.Amount)
		if err != nil {
			return app.InstallmentPurchaseInput{}, err
		}

		in.Splits = append(in.Splits, domain.Posting{AccountID: sp.AccountId, Amount: amount})
	}

	if b.Interest != nil {
		interest, err := fromMoneyAPI("interest", *b.Interest)
		if err != nil {
			return app.InstallmentPurchaseInput{}, err
		}

		in.Interest = &interest
	}

	if b.InstallmentAmounts != nil {
		for i, a := range *b.InstallmentAmounts {
			amount, err := fromMoneyAPI(fmt.Sprintf("installment_amounts[%d]", i), a)
			if err != nil {
				return app.InstallmentPurchaseInput{}, err
			}

			in.Amounts = append(in.Amounts, amount)
		}
	}

	first, err := optMonth("first_statement", b.FirstStatement)
	if err != nil {
		return app.InstallmentPurchaseInput{}, err
	}

	in.FirstStatement = first

	return in, nil
}

func (s *Server) getCommitment(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (Commitment, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Commitment{}, err
	}

	params, err := httpserver.Query[GetCommitmentParams](r)
	if err != nil {
		return Commitment{}, err
	}

	m, err := domain.ParseReferenceMonth(params.Month)
	if err != nil {
		return Commitment{}, &domain.FieldError{Field: "month", Message: "must be YYYY-MM", Err: domain.ErrValidation}
	}

	amount, err := s.svc.Commitment(ctx, auth.MustBooksID(ctx), id, m)
	if err != nil {
		return Commitment{}, err
	}

	return Commitment{Month: m.String(), Amount: toMoneyAPI(amount)}, nil
}

func (s *Server) payStatement(
	ctx context.Context,
	r *http.Request,
	in PayStatementJSONRequestBody,
) (Transaction, string, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Transaction{}, "", err
	}

	amount, err := fromMoneyAPI("amount", in.Amount)
	if err != nil {
		return Transaction{}, "", err
	}

	t, err := s.svc.PayStatement(ctx, auth.MustBooksID(ctx), id, dateOf(in.Date), in.FromAccountId, amount)
	if err != nil {
		return Transaction{}, "", err
	}

	return toTransactionAPI(t), location("/transactions/", t.ID), nil
}

func (s *Server) financeStatement(
	ctx context.Context,
	r *http.Request,
	in FinanceStatementJSONRequestBody,
) (InstallmentPurchase, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return InstallmentPurchase{}, err
	}

	installment, err := fromMoneyAPI("installment_amount", in.InstallmentAmount)
	if err != nil {
		return InstallmentPurchase{}, err
	}

	t, planID, err := s.svc.FinanceStatement(ctx, auth.MustBooksID(ctx), id, dateOf(in.Date), in.InstallmentCount, installment)
	if err != nil {
		return InstallmentPurchase{}, err
	}

	return InstallmentPurchase{Transaction: toTransactionAPI(t), PlanId: planID}, nil
}

func (s *Server) refundTransaction(
	ctx context.Context,
	r *http.Request,
	in RefundTransactionJSONRequestBody,
) (Transaction, string, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Transaction{}, "", err
	}

	amount, err := fromMoneyAPI("amount", in.Amount)
	if err != nil {
		return Transaction{}, "", err
	}

	statement, err := optMonth("statement", in.Statement)
	if err != nil {
		return Transaction{}, "", err
	}

	t, err := s.svc.RefundPurchase(ctx, auth.MustBooksID(ctx), id, dateOf(in.Date), amount, statement)
	if err != nil {
		return Transaction{}, "", err
	}

	return toTransactionAPI(t), location("/transactions/", t.ID), nil
}

func (s *Server) cancelInstallmentPlan(
	ctx context.Context,
	r *http.Request,
	in CancelInstallmentPlanJSONRequestBody,
) (Transaction, string, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Transaction{}, "", err
	}

	statement, err := optMonth("credit_statement", in.CreditStatement)
	if err != nil {
		return Transaction{}, "", err
	}

	t, err := s.svc.CancelPlan(ctx, auth.MustBooksID(ctx), id, dateOf(in.Date), statement)
	if err != nil {
		return Transaction{}, "", err
	}

	return toTransactionAPI(t), location("/transactions/", t.ID), nil
}

func (s *Server) anticipateInstallments(
	ctx context.Context,
	r *http.Request,
	in AnticipateInstallmentsJSONRequestBody,
) (Transaction, string, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Transaction{}, "", err
	}

	b := in

	amount, err := fromMoneyAPI("amount", b.Amount)
	if err != nil {
		return Transaction{}, "", err
	}

	target, err := optMonth("target_statement", &b.TargetStatement)
	if err != nil {
		return Transaction{}, "", err
	}

	t, err := s.svc.AnticipatePlan(ctx, auth.MustBooksID(ctx), id, dateOf(b.Date), b.FromInstallment, b.ToInstallment, *target, amount)
	if err != nil {
		return Transaction{}, "", err
	}

	return toTransactionAPI(t), location("/transactions/", t.ID), nil
}

func (s *Server) getInstallmentPlan(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (InstallmentPlan, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return InstallmentPlan{}, err
	}

	v, err := s.svc.InstallmentPlan(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return InstallmentPlan{}, err
	}

	out := InstallmentPlan{
		Id: v.Plan.ID, TransactionId: v.Plan.OriginTransactionID, AccountId: v.Plan.AccountID,
		Status: InstallmentPlanStatus(v.Status), Count: v.Plan.Count, Installments: make([]ScheduledInstallment, len(v.Installments)),
	}
	if !v.Plan.Interest.IsZero() {
		interest := toMoneyAPI(v.Plan.Interest)
		out.Interest = &interest
	}

	for i, input := range v.Installments {
		amount, err := money.New(input.Amount, v.Plan.Interest.Currency())
		if err != nil {
			return InstallmentPlan{}, err
		}

		out.Installments[i] = ScheduledInstallment{Number: input.Number, Statement: input.Reference.String(), Amount: toMoneyAPI(amount), Reversed: input.Reversed}
	}

	return out, nil
}

func (s *Server) getStatementPlacement(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (StatementPlacement, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return StatementPlacement{}, err
	}

	params, err := httpserver.Query[GetStatementPlacementParams](r)
	if err != nil {
		return StatementPlacement{}, err
	}

	p, err := s.svc.PlaceStatement(ctx, auth.MustBooksID(ctx), id, dateOf(params.Date))
	if err != nil {
		return StatementPlacement{}, err
	}

	out := StatementPlacement{Reference: p.Reference.String(), ClosingDate: apiDate(p.Closing), DueDate: apiDate(p.Due)}
	if p.Previous != nil {
		closing, due := apiDate(p.Previous.Closing), apiDate(p.Previous.Due)
		out.PreviousClosingDate, out.PreviousDueDate = &closing, &due
	}

	return out, nil
}
