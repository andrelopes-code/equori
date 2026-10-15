package httpapi

import (
	"context"
	"fmt"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) CreateInstallmentPurchase(ctx context.Context, req CreateInstallmentPurchaseRequestObject) (CreateInstallmentPurchaseResponseObject, error) {
	b := req.Body
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
			return nil, err
		}
		in.Splits = append(in.Splits, domain.Posting{AccountID: sp.AccountId, Amount: amount})
	}
	if b.Interest != nil {
		interest, err := fromMoneyAPI("interest", *b.Interest)
		if err != nil {
			return nil, err
		}
		in.Interest = &interest
	}
	if b.InstallmentAmounts != nil {
		for i, a := range *b.InstallmentAmounts {
			amount, err := fromMoneyAPI(fmt.Sprintf("installment_amounts[%d]", i), a)
			if err != nil {
				return nil, err
			}
			in.Amounts = append(in.Amounts, amount)
		}
	}
	first, err := optMonth("first_statement", b.FirstStatement)
	if err != nil {
		return nil, err
	}
	in.FirstStatement = first
	t, planID, err := s.svc.InstallmentPurchase(ctx, auth.MustUserID(ctx), in)
	if err != nil {
		return nil, err
	}
	return CreateInstallmentPurchase201JSONResponse{Transaction: toTransactionAPI(t), PlanId: planID}, nil
}

func (s *Server) GetCommitment(ctx context.Context, req GetCommitmentRequestObject) (GetCommitmentResponseObject, error) {
	m, err := domain.ParseReferenceMonth(req.Params.Month)
	if err != nil {
		return nil, &domain.FieldError{Field: "month", Message: "must be YYYY-MM", Err: domain.ErrValidation}
	}
	amount, err := s.svc.Commitment(ctx, auth.MustUserID(ctx), req.Id, m)
	if err != nil {
		return nil, err
	}
	return GetCommitment200JSONResponse{Month: m.String(), Amount: toMoneyAPI(amount)}, nil
}

func (s *Server) PayStatement(ctx context.Context, req PayStatementRequestObject) (PayStatementResponseObject, error) {
	amount, err := fromMoneyAPI("amount", req.Body.Amount)
	if err != nil {
		return nil, err
	}
	t, err := s.svc.PayStatement(ctx, auth.MustUserID(ctx), req.Id, dateOf(req.Body.Date), req.Body.FromAccountId, amount)
	if err != nil {
		return nil, err
	}
	return PayStatement201JSONResponse{Body: toTransactionAPI(t), Headers: PayStatement201ResponseHeaders{Location: location("/transactions/", t.ID)}}, nil
}

func (s *Server) FinanceStatement(ctx context.Context, req FinanceStatementRequestObject) (FinanceStatementResponseObject, error) {
	installment, err := fromMoneyAPI("installment_amount", req.Body.InstallmentAmount)
	if err != nil {
		return nil, err
	}
	t, planID, err := s.svc.FinanceStatement(ctx, auth.MustUserID(ctx), req.Id, dateOf(req.Body.Date), req.Body.InstallmentCount, installment)
	if err != nil {
		return nil, err
	}
	return FinanceStatement201JSONResponse{Transaction: toTransactionAPI(t), PlanId: planID}, nil
}

func (s *Server) RefundTransaction(ctx context.Context, req RefundTransactionRequestObject) (RefundTransactionResponseObject, error) {
	amount, err := fromMoneyAPI("amount", req.Body.Amount)
	if err != nil {
		return nil, err
	}
	statement, err := optMonth("statement", req.Body.Statement)
	if err != nil {
		return nil, err
	}
	t, err := s.svc.RefundPurchase(ctx, auth.MustUserID(ctx), req.Id, dateOf(req.Body.Date), amount, statement)
	if err != nil {
		return nil, err
	}
	return RefundTransaction201JSONResponse{Body: toTransactionAPI(t), Headers: RefundTransaction201ResponseHeaders{Location: location("/transactions/", t.ID)}}, nil
}

func (s *Server) CancelInstallmentPlan(ctx context.Context, req CancelInstallmentPlanRequestObject) (CancelInstallmentPlanResponseObject, error) {
	statement, err := optMonth("credit_statement", req.Body.CreditStatement)
	if err != nil {
		return nil, err
	}
	t, err := s.svc.CancelPlan(ctx, auth.MustUserID(ctx), req.Id, dateOf(req.Body.Date), statement)
	if err != nil {
		return nil, err
	}
	return CancelInstallmentPlan201JSONResponse{Body: toTransactionAPI(t), Headers: CancelInstallmentPlan201ResponseHeaders{Location: location("/transactions/", t.ID)}}, nil
}

func (s *Server) AnticipateInstallments(ctx context.Context, req AnticipateInstallmentsRequestObject) (AnticipateInstallmentsResponseObject, error) {
	b := req.Body
	amount, err := fromMoneyAPI("amount", b.Amount)
	if err != nil {
		return nil, err
	}
	target, err := optMonth("target_statement", &b.TargetStatement)
	if err != nil {
		return nil, err
	}
	t, err := s.svc.AnticipatePlan(ctx, auth.MustUserID(ctx), req.Id, dateOf(b.Date), b.FromInstallment, b.ToInstallment, *target, amount)
	if err != nil {
		return nil, err
	}
	return AnticipateInstallments201JSONResponse{Body: toTransactionAPI(t), Headers: AnticipateInstallments201ResponseHeaders{Location: location("/transactions/", t.ID)}}, nil
}
