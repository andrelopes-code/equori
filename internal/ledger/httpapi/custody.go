package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) recordCustodyTransfer(
	ctx context.Context,
	r *http.Request,
	in RecordCustodyTransferJSONRequestBody,
) (Transaction, string, error) {
	code, err := s.svc.ResolveCode(ctx, money.Currency(in.Quantity.Currency))
	if err != nil {
		return Transaction{}, "", err
	}

	quantity, err := s.svc.AmountOf(ctx, in.Quantity.Amount, code)
	if err != nil {
		return Transaction{}, "", &domain.FieldError{
			Field:   "quantity",
			Message: err.Error(),
			Err:     domain.ErrValidation,
		}
	}

	t, err := s.svc.RecordCustodyTransfer(ctx, auth.MustBooksID(ctx), domain.CustodyOrder{
		AccountID:   in.AccountId,
		BrokerageID: in.BrokerageId,
		Date:        dateOf(in.Date),
		Quantity:    quantity,
		Description: optString(in.Description),
	})
	if err != nil {
		return Transaction{}, "", err
	}

	return toTransactionAPI(t), location("/transactions/", t.ID), nil
}
