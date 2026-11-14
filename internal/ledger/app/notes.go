package app

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// orderFields are the fields of a note order that an error names as orders[i].<field>.
var orderFields = map[string]bool{
	"side": true, "instrument": true, "quantity": true, "unit_price": true,
	"fees": true, "taxes": true, "account_id": true,
}

// NoteOrder is one order of a note; its costs come from the note.
type NoteOrder struct {
	Side       domain.Side
	Instrument money.Currency
	Quantity   money.Money
	UnitPrice  money.Rate
}

// BrokerageNote is one note of a brokerage: orders of one date, costs and withheld tax (A228 IO17).
type BrokerageNote struct {
	BrokerageID, CashAccountID, TaxesCategoryID uuid.UUID
	Date                                        time.Time
	SettlementDate                              *time.Time
	Fees, Taxes                                 *money.Money
	Description                                 string
	Orders                                      []NoteOrder
}

// RecordBrokerageNote records the orders of n as trades in one database transaction, buys first
// (A228 IO17 to IO21); the result is in the order of n.Orders.
func (s *Service) RecordBrokerageNote(
	ctx context.Context,
	booksID int64,
	n BrokerageNote,
) ([]domain.Transaction, error) {
	if len(n.Orders) == 0 {
		return nil, fieldErr("orders", "add at least one order", domain.ErrValidation)
	}

	created := make([]domain.Transaction, len(n.Orders))
	err := s.repo.InTx(ctx, func(r Repository) error {
		base, err := baseCurrency(ctx, r, booksID)
		if err != nil {
			return err
		}

		orders, err := noteTrades(n, base)
		if err != nil {
			return err
		}

		for _, i := range buysFirst(n.Orders) {
			created[i], err = s.recordTrade(ctx, r, booksID, orders[i], base)
			if err != nil {
				return inOrder(err, i)
			}
		}

		return nil
	})

	return created, err
}

// noteTrades builds the trade order of each order of n: the note's fees are split over every
// gross and its taxes over the gross of the sales (A228 IO18, IO19).
func noteTrades(n BrokerageNote, base money.Currency) ([]domain.TradeOrder, error) {
	grosses := make([]int64, len(n.Orders))
	saleGrosses := make([]int64, len(n.Orders))

	for i, o := range n.Orders {
		if o.Side != domain.SideBuy && o.Side != domain.SideSell {
			return nil, inOrder(fieldErr("side", "must be buy or sell", domain.ErrValidation), i)
		}

		gross, err := money.Convert(o.Quantity, base, money.Leg{Rate: o.UnitPrice})
		if err != nil {
			return nil, inOrder(fieldErr("unit_price", err.Error(), domain.ErrValidation), i)
		}

		grosses[i] = gross.Amount()
		if o.Side == domain.SideSell {
			saleGrosses[i] = gross.Amount()
		}
	}

	fees, err := noteShares("fees", n.Fees, base, grosses)
	if err != nil {
		return nil, err
	}

	taxes, err := noteShares("taxes", n.Taxes, base, saleGrosses)
	if err != nil {
		return nil, err
	}

	orders := make([]domain.TradeOrder, len(n.Orders))
	for i, o := range n.Orders {
		orders[i] = domain.TradeOrder{
			CashAccountID:   n.CashAccountID,
			BrokerageID:     n.BrokerageID,
			TaxesCategoryID: n.TaxesCategoryID,
			Instrument:      o.Instrument,
			Side:            o.Side,
			Date:            n.Date,
			SettlementDate:  n.SettlementDate,
			Quantity:        o.Quantity,
			UnitPrice:       o.UnitPrice,
			Fees:            &fees[i],
			Taxes:           &taxes[i],
			Description:     n.Description,
		}
	}

	return orders, nil
}

// noteShares splits total over weights in the base currency; a total with no positive weight to
// carry it is an error of field.
func noteShares(
	field string,
	total *money.Money,
	base money.Currency,
	weights []int64,
) ([]money.Money, error) {
	var amount int64
	if total != nil {
		if total.Currency() != base || total.IsNegative() {
			return nil, fieldErr(
				field, "must be a non-negative amount in "+string(base), domain.ErrValidation,
			)
		}

		amount = total.Amount()
	}

	var weight int64
	for _, w := range weights {
		weight += w
	}

	if amount > 0 && weight == 0 {
		return nil, fieldErr(field, "are withheld on sales only", domain.ErrValidation)
	}

	shares := make([]money.Money, len(weights))
	for i, a := range domain.Apportion(amount, weights) {
		m, err := money.New(a, base)
		if err != nil {
			return nil, err
		}

		shares[i] = m
	}

	return shares, nil
}

// buysFirst returns the indexes of orders: the buys in note order, then the sales (A228 IO20).
func buysFirst(orders []NoteOrder) []int {
	indexes := make([]int, 0, len(orders))
	for _, side := range []domain.Side{domain.SideBuy, domain.SideSell} {
		for i, o := range orders {
			if o.Side == side {
				indexes = append(indexes, i)
			}
		}
	}

	return indexes
}

// inOrder prefixes the field of err with the order that raised it; a field of the note stays.
func inOrder(err error, i int) error {
	var fe *domain.FieldError
	if !errors.As(err, &fe) || !orderFields[fe.Field] {
		return err
	}

	return &domain.FieldError{
		Field:   "orders[" + strconv.Itoa(i) + "]." + fe.Field,
		Message: fe.Message,
		Err:     fe.Err,
	}
}
