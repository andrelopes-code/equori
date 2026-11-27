package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

func (s *Server) recordBrokerageNote(
	ctx context.Context,
	r *http.Request,
	in RecordBrokerageNoteJSONRequestBody,
) (BrokerageNote, string, error) {
	n, err := s.noteFromInput(ctx, in)
	if err != nil {
		return BrokerageNote{}, "", err
	}

	created, err := s.svc.RecordBrokerageNote(ctx, auth.MustBooksID(ctx), n)
	if err != nil {
		return BrokerageNote{}, "", err
	}

	out := BrokerageNote{Transactions: make([]Transaction, len(created))}
	for i, t := range created {
		out.Transactions[i] = toTransactionAPI(t)
	}

	return out, location("/transactions/", created[0].ID), nil
}

func (s *Server) noteFromInput(
	ctx context.Context,
	b BrokerageNoteInput,
) (app.BrokerageNote, error) {
	n := app.BrokerageNote{
		BrokerageID:     b.BrokerageId,
		CashAccountID:   optUUID(b.CashAccountId),
		TaxesCategoryID: optUUID(b.TaxesCategoryId),
		Date:            dateOf(b.Date),
		SettlementDate:  optDate(b.SettlementDate),
		Description:     optString(b.Description),
		Orders:          make([]app.NoteOrder, len(b.Orders)),
	}

	for i, o := range b.Orders {
		order, err := s.noteOrderFromInput(ctx, o)
		if err != nil {
			return app.BrokerageNote{}, inOrder(err, i)
		}

		n.Orders[i] = order
	}

	var err error
	if n.Fees, err = optMoneyAPI("fees", b.Fees); err != nil {
		return app.BrokerageNote{}, err
	}

	if n.Taxes, err = optMoneyAPI("taxes", b.Taxes); err != nil {
		return app.BrokerageNote{}, err
	}

	if n.ExchangeRate, err = exchangeRate(b.ExchangeRate); err != nil {
		return app.BrokerageNote{}, err
	}

	return n, nil
}

// noteOrderFromInput resolves the odd-lot codes of o as tradeOrderFromInput does.
func (s *Server) noteOrderFromInput(
	ctx context.Context,
	b BrokerageNoteOrder,
) (app.NoteOrder, error) {
	code, err := s.svc.ResolveCode(ctx, money.Currency(b.Quantity.Currency))
	if err != nil {
		return app.NoteOrder{}, err
	}

	instrument, err := s.svc.ResolveCode(ctx, money.Currency(b.Instrument))
	if err != nil {
		return app.NoteOrder{}, err
	}

	quantity, err := s.svc.AmountOf(ctx, b.Quantity.Amount, code)
	if err != nil {
		return app.NoteOrder{}, &domain.FieldError{
			Field:   "quantity",
			Message: err.Error(),
			Err:     domain.ErrValidation,
		}
	}

	price, err := money.ParseRate(b.UnitPrice)
	if err != nil {
		return app.NoteOrder{}, &domain.FieldError{
			Field:   "unit_price",
			Message: "must be a positive decimal with at most 12 decimals",
			Err:     domain.ErrValidation,
		}
	}

	return app.NoteOrder{
		Side:       domain.Side(b.Side),
		Instrument: instrument,
		Quantity:   quantity,
		UnitPrice:  price,
	}, nil
}

func optMoneyAPI(field string, m *Money) (*money.Money, error) {
	if m == nil {
		return nil, nil
	}

	v, err := fromMoneyAPI(field, *m)
	if err != nil {
		return nil, err
	}

	return &v, nil
}

// inOrder names the field of a FieldError as orders[i].<field>.
func inOrder(err error, i int) error {
	var fe *domain.FieldError
	if !errors.As(err, &fe) {
		return err
	}

	return &domain.FieldError{
		Field:   "orders[" + strconv.Itoa(i) + "]." + fe.Field,
		Message: fe.Message,
		Err:     fe.Err,
	}
}
