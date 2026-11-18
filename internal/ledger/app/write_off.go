package app

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// writeOffHolding resolves the holding a write-off names by account_id, or by brokerage_id and
// instrument without creating it; no cash moves, so the cash side of the order is the base
// currency alone (listed options design W1, O8).
func (s *Service) writeOffHolding(
	ctx context.Context,
	r Repository,
	booksID int64,
	o *domain.TradeOrder,
	base money.Currency,
) (security, cash domain.Account, err error) {
	if o.CashAccountID != uuid.Nil {
		return domain.Account{}, domain.Account{}, fieldErr(
			"cash_account_id",
			"is not taken by a write-off",
			domain.ErrValidation,
		)
	}

	if err := checkTargetForm(target{
		AccountID: o.AccountID, BrokerageID: o.BrokerageID, Instrument: o.Instrument,
	}); err != nil {
		return domain.Account{}, domain.Account{}, err
	}

	if o.AccountID == uuid.Nil {
		_, o.AccountID, err = s.pairTarget(ctx, r, booksID, target{
			BrokerageID: o.BrokerageID, Instrument: o.Instrument,
		})
		if err != nil {
			return domain.Account{}, domain.Account{}, err
		}
	}

	security, err = loadAccount(ctx, r, booksID, o.AccountID, "account_id")
	if err != nil {
		return domain.Account{}, domain.Account{}, err
	}

	if o.Quantity.Currency() != security.Instrument {
		return domain.Account{}, domain.Account{}, fieldErr(
			"quantity",
			"must be an amount of "+string(security.Instrument),
			domain.ErrValidation,
		)
	}

	return security, domain.Account{Instrument: base}, nil
}
