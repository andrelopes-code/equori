package app

import (
	"context"
	"errors"
	"fmt"
	"slices"
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
	ExchangeRate                                *money.Rate // one rate for every order (FC9)
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

	var created []domain.Transaction
	err := s.repo.InTx(ctx, func(r Repository) error {
		var err error
		created, err = s.recordNote(ctx, r, booksID, n)

		return err
	})

	return created, err
}

// recordNote records the trades of n and, when their cash moves inside the brokerage, the
// settlements of the cash account (A272 NS1 to NS3).
func (s *Service) recordNote(
	ctx context.Context,
	r Repository,
	booksID int64,
	n BrokerageNote,
) ([]domain.Transaction, error) {
	base, err := baseCurrency(ctx, r, booksID)
	if err != nil {
		return nil, err
	}

	cash, rate, err := s.noteCash(ctx, r, booksID, n, base)
	if err != nil {
		return nil, err
	}

	inner, err := innerCash(ctx, r, booksID, n, cash)
	if err != nil {
		return nil, err
	}

	traded := n
	if inner != uuid.Nil {
		traded.CashAccountID = inner
	}

	orders, err := noteTrades(traded, cash, rate)
	if err != nil {
		return nil, err
	}

	created := make([]domain.Transaction, len(n.Orders))
	for _, i := range buysFirst(n.Orders) {
		created[i], err = s.recordTrade(ctx, r, booksID, orders[i], base)
		if err != nil {
			return nil, inOrder(err, i)
		}
	}

	if inner == uuid.Nil {
		return created, nil
	}

	return created, s.recordSettlements(ctx, r, booksID, n, inner, base, created)
}

// noteCash returns the currency of the cash account of n and the rate of the note: its amounts are
// in that currency and every order converts at that rate (foreign cash FC9). A note with no cash
// account takes the default cash of the brokerage, in the base currency.
func (s *Service) noteCash(
	ctx context.Context,
	r Repository,
	booksID int64,
	n BrokerageNote,
	base money.Currency,
) (money.Currency, *money.Rate, error) {
	cash := base

	if n.CashAccountID != uuid.Nil {
		account, err := loadAccount(ctx, r, booksID, n.CashAccountID, "cash_account_id")
		if err != nil {
			return "", nil, err
		}

		cash = account.Instrument
	}

	rate, err := s.cashRate(ctx, cash, base, n.Date, n.ExchangeRate)

	return cash, rate, err
}

// innerCash returns the cash account of the brokerage that takes the orders of n when the cash
// account of n lies outside it: its one open child in the currency cash; uuid.Nil otherwise
// (A272 NS1, NS4).
func innerCash(
	ctx context.Context,
	r Repository,
	booksID int64,
	n BrokerageNote,
	cash money.Currency,
) (uuid.UUID, error) {
	if n.CashAccountID == uuid.Nil || n.CashAccountID == n.BrokerageID {
		return uuid.Nil, nil
	}

	account, err := loadAccount(ctx, r, booksID, n.CashAccountID, "cash_account_id")
	if err != nil || account.ParentID == n.BrokerageID {
		return uuid.Nil, err
	}

	children, err := r.ChildAccounts(ctx, booksID, n.BrokerageID)
	if err != nil {
		return uuid.Nil, err
	}

	found := slices.DeleteFunc(children, func(c domain.Account) bool {
		return c.Instrument != cash || c.ClosedOn != nil
	})
	if len(found) != 1 {
		return uuid.Nil, nil
	}

	return found[0].ID, nil
}

// recordSettlements records, per settlement date of the trades, one transaction that moves the
// sum of their cash postings on inner from the cash account of n (A272 NS2).
func (s *Service) recordSettlements(
	ctx context.Context,
	r Repository,
	booksID int64,
	n BrokerageNote,
	inner uuid.UUID,
	base money.Currency,
	trades []domain.Transaction,
) error {
	w, err := s.writerFor(ctx, booksID)
	if err != nil {
		return err
	}

	sets, err := settlementsOf(trades, inner)
	if err != nil {
		return err
	}

	for _, set := range sets {
		if set.amount.IsZero() {
			continue
		}

		t := domain.Transaction{
			BooksID:           booksID,
			Date:              n.Date,
			Description:       fmt.Sprintf(w.NoteSettlement, n.Date.Format(w.layout)),
			BalancingCurrency: base,
			Origin:            domain.OriginManual,
			Postings: []domain.Posting{
				{
					AccountID: n.CashAccountID,
					Amount:    set.amount,
					Weight:    set.weight,
					SettledOn: set.on,
				},
				{
					AccountID: inner,
					Amount:    set.amount.Neg(),
					Weight:    set.weight.Neg(),
					SettledOn: set.on,
				},
			},
		}

		if _, err := s.insert(ctx, r, t); err != nil {
			return err
		}
	}

	return nil
}

// settlement is the cash of the trades of a note that settle on one date, nil for the note date.
type settlement struct {
	on             *time.Time
	amount, weight money.Money
}

// settlementsOf sums the cash postings on inner of trades by settlement date, in the order of
// first appearance.
func settlementsOf(trades []domain.Transaction, inner uuid.UUID) ([]settlement, error) {
	var out []settlement

	for _, t := range trades {
		for _, p := range t.Postings {
			if p.AccountID != inner {
				continue
			}

			i := slices.IndexFunc(out, func(x settlement) bool { return same(x.on, p.SettledOn) })
			if i == -1 {
				out = append(out, settlement{on: p.SettledOn, amount: p.Amount, weight: p.Weight})

				continue
			}

			amount, err := out[i].amount.Add(p.Amount)
			if err != nil {
				return nil, err
			}

			weight, err := out[i].weight.Add(p.Weight)
			if err != nil {
				return nil, err
			}

			out[i].amount, out[i].weight = amount, weight
		}
	}

	return out, nil
}

func same(a, b *time.Time) bool {
	return (a == nil && b == nil) || (a != nil && b != nil && a.Equal(*b))
}

// noteTrades builds the trade order of each order of n: the note's fees are split over every
// gross and its taxes over the gross of the sales, in the currency cash of the note (A228 IO18,
// IO19); each order takes rate.
func noteTrades(
	n BrokerageNote,
	cash money.Currency,
	rate *money.Rate,
) ([]domain.TradeOrder, error) {
	grosses := make([]int64, len(n.Orders))
	saleGrosses := make([]int64, len(n.Orders))

	for i, o := range n.Orders {
		if o.Side != domain.SideBuy && o.Side != domain.SideSell {
			return nil, inOrder(fieldErr("side", "must be buy or sell", domain.ErrValidation), i)
		}

		gross, err := money.Convert(o.Quantity, cash, money.Leg{Rate: o.UnitPrice})
		if err != nil {
			return nil, inOrder(fieldErr("unit_price", err.Error(), domain.ErrValidation), i)
		}

		grosses[i] = gross.Amount()
		if o.Side == domain.SideSell {
			saleGrosses[i] = gross.Amount()
		}
	}

	fees, err := noteShares("fees", n.Fees, cash, grosses)
	if err != nil {
		return nil, err
	}

	taxes, err := noteShares("taxes", n.Taxes, cash, saleGrosses)
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
			ExchangeRate:    rate,
			Description:     n.Description,
		}
	}

	return orders, nil
}

// noteShares splits total over weights in the currency of the note; a total with no positive weight to
// carry it is an error of field.
func noteShares(
	field string,
	total *money.Money,
	currency money.Currency,
	weights []int64,
) ([]money.Money, error) {
	var amount int64
	if total != nil {
		if total.Currency() != currency || total.IsNegative() {
			return nil, fieldErr(
				field, "must be a non-negative amount in "+string(currency), domain.ErrValidation,
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
		m, err := money.New(a, currency)
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
