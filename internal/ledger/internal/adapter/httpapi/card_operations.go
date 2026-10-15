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
