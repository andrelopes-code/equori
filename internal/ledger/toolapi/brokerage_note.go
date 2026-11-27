package toolapi

import (
	"context"
	"fmt"
	"slices"
	"strconv"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type noteSide string

func (noteSide) Values() []string { return []string{"buy", "sell"} }

type brokerageNoteOrder struct {
	Side       noteSide `json:"side"       jsonschema:"buy or sell"`
	Instrument string   `json:"instrument" jsonschema:"code of the security, such as PETR4; odd-lot PETR4F is PETR4"`
	Quantity   string   `json:"quantity"   jsonschema:"positive quantity"`
	UnitPrice  string   `json:"unit_price" jsonschema:"price of one unit, without costs"`
}

type recordBrokerageNoteIn struct {
	BrokerageID     string               `json:"brokerage_id"               jsonschema:"Brokerage of the note, from list_accounts"`
	CashAccountID   string               `json:"cash_account_id,omitzero"   jsonschema:"cash account of the Brokerage or its institution; the single candidate if absent"`
	Date            tool.Date            `json:"date"                       jsonschema:"trade date of the note"`
	SettlementDate  tool.Date            `json:"settlement_date,omitzero"   jsonschema:"cash settlement day; derived when empty"`
	ExchangeRate    string               `json:"exchange_rate,omitzero"     jsonschema:"one rate for the note: base currency per cash unit; day rate if empty"`
	Fees            string               `json:"fees,omitzero"              jsonschema:"every cost of the whole note, positive; split by gross value"`
	Taxes           string               `json:"taxes,omitzero"             jsonschema:"tax withheld on the whole note, positive; split among the sales"`
	TaxesCategoryID string               `json:"taxes_category_id,omitzero" jsonschema:"expense category of the taxes; the taxes account when absent"`
	Description     string               `json:"description,omitzero"       jsonschema:"description of each transaction; derived when empty"`
	Orders          []brokerageNoteOrder `json:"orders"                     jsonschema:"the orders of the note, 1 to 50"`
}

type recordBrokerageNoteOut struct {
	TransactionIDs []string `json:"transaction_ids"`
}

func recordBrokerageNote(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "record_brokerage_note",
		Description: "Proposes one brokerage note: the several orders of one day at one Brokerage, with the costs and the withheld tax of the whole note. " +
			"Each order becomes a trade of its own; the costs are split by gross value. " +
			"Use it when the user reports a note or more than one trade of the same day at the same Brokerage. " +
			"Each security must exist: manage_instrument defines a new one. " +
			"Do not use it for one trade whose own costs are known: record_investment does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in recordBrokerageNoteIn) (tool.Preview, error) {
		pv, _, err := planBrokerageNote(ctx, svc, booksID, in)
		return pv, err
	}, func(ctx context.Context, booksID int64, in recordBrokerageNoteIn) (recordBrokerageNoteOut, error) {
		_, n, err := planBrokerageNote(ctx, svc, booksID, in)
		if err != nil {
			return recordBrokerageNoteOut{}, err
		}

		created, err := svc.RecordBrokerageNote(ctx, booksID, n)
		if err != nil {
			return recordBrokerageNoteOut{}, err
		}

		out := recordBrokerageNoteOut{TransactionIDs: make([]string, len(created))}
		for i, t := range created {
			out.TransactionIDs[i] = t.ID.String()
		}

		return out, nil
	})
}

func planBrokerageNote(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordBrokerageNoteIn,
) (tool.Preview, app.BrokerageNote, error) {
	pv := tool.Preview{Action: "record_brokerage_note"}

	n, target, err := brokerageNoteHeader(ctx, svc, booksID, in)
	if err != nil {
		return pv, n, err
	}

	pv.Target = target.name

	if n.Fees, err = optionalAmount("fees", in.Fees, target.cashUnit); err != nil {
		return pv, n, err
	}

	if n.Taxes, err = optionalAmount("taxes", in.Taxes, target.cashUnit); err != nil {
		return pv, n, err
	}

	if n.Orders, err = brokerageNoteOrders(ctx, svc, in.Orders); err != nil {
		return pv, n, err
	}

	if n.ExchangeRate, err = parseExchangeRate(in.ExchangeRate); err != nil {
		return pv, n, err
	}

	plus, minus, err := appendNoteMoney(&pv, n, target.cashUnit)
	if err != nil {
		return pv, n, err
	}

	rate := rateStep{svc, booksID, n.Date, n.ExchangeRate, in.ExchangeRate}

	if err = rate.appendChanges(ctx, &pv, target.cashUnit.Currency(), plus, minus); err != nil {
		return pv, n, err
	}

	if target.cashName != "" {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "account", After: tool.TextValue(target.cashName)},
		)
	}

	pv.Changes = append(pv.Changes, tool.Change{Field: "date", After: tool.DateValue(n.Date)})

	return pv, n, appendNoteSettlement(ctx, svc, &pv, n)
}

// brokerageNoteHeader resolves the brokerage and the cash of the note; the service picks the
// default cash at run time.
func brokerageNoteHeader(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in recordBrokerageNoteIn,
) (app.BrokerageNote, investmentTarget, error) {
	n := app.BrokerageNote{Date: in.Date.Time, Description: in.Description}

	var target investmentTarget

	var ids investmentIDs

	var err error
	if n.BrokerageID, err = optionalID(in.BrokerageID, "brokerage_id"); err != nil {
		return n, target, err
	}

	if ids.cash, err = optionalID(in.CashAccountID, "cash_account_id"); err != nil {
		return n, target, err
	}

	if n.TaxesCategoryID, err = optionalID(in.TaxesCategoryID, "taxes_category_id"); err != nil {
		return n, target, err
	}

	n.CashAccountID, ids.brokerage = ids.cash, n.BrokerageID
	if !in.SettlementDate.IsZero() {
		n.SettlementDate = &in.SettlementDate.Time
	}

	brokerage, err := svc.Account(ctx, booksID, n.BrokerageID)
	if err != nil {
		return n, target, err
	}

	target.name = brokerage.Name

	unit, err := resolveTargetCash(ctx, svc, booksID, ids, &target)
	if err != nil {
		return n, target, err
	}

	target.cashUnit, err = svc.AmountOf(ctx, 0, unit)

	return n, target, err
}

func brokerageNoteOrders(
	ctx context.Context,
	svc *app.Service,
	in []brokerageNoteOrder,
) ([]app.NoteOrder, error) {
	orders := make([]app.NoteOrder, len(in))

	for i, o := range in {
		field := "orders[" + strconv.Itoa(i) + "]."

		instrument, err := svc.ResolveCode(ctx, money.Currency(o.Instrument))
		if err != nil {
			return nil, err
		}

		unit, err := svc.AmountOf(ctx, 0, instrument)
		if err != nil {
			return nil, err
		}

		quantity, err := tool.ParsePositive(field+"quantity", o.Quantity, unit)
		if err != nil {
			return nil, err
		}

		price, err := money.ParseRate(o.UnitPrice)
		if err != nil {
			return nil, tool.InvalidArgument(
				field+"unit_price",
				"must be a positive decimal with at most 12 decimals",
			)
		}

		orders[i] = app.NoteOrder{
			Side:       domain.Side(o.Side),
			Instrument: instrument,
			Quantity:   quantity,
			UnitPrice:  price,
		}
	}

	return orders, nil
}

// appendNoteMoney adds one item per order, the costs and the signed change of the cash
// (investment proposals design, IP1 and IP3).
func appendNoteMoney(
	pv *tool.Preview,
	n app.BrokerageNote,
	cash money.Money,
) (plus, minus []*money.Money, err error) {
	total := cash
	grosses := make([]int64, len(n.Orders))
	saleGrosses := make([]int64, len(n.Orders))

	for i, o := range n.Orders {
		gross, err := grossOf(o.Quantity, o.UnitPrice, cash.Currency())
		if err != nil {
			return nil, nil, err
		}

		grosses[i] = gross.Amount()

		signed := gross
		if o.Side == domain.SideBuy {
			signed = gross.Neg()
			plus = append(plus, &gross)
		} else {
			saleGrosses[i] = gross.Amount()
			minus = append(minus, &gross)
		}

		if total, err = total.Add(signed); err != nil {
			return nil, nil, fmt.Errorf("add orders of the note: %w", err)
		}

		pv.Items = append(pv.Items, tool.Item{
			Description: string(o.Instrument),
			Side:        string(o.Side),
			Quantity:    tool.TextValue(o.Quantity.Decimal()),
			Price:       tool.TextValue(o.UnitPrice.String()),
			Amount:      tool.MoneyValue(gross),
		})
	}

	net, err := subtract(total, n.Fees, n.Taxes)
	if err != nil {
		return nil, nil, err
	}

	appendMoneyChange(pv, "fees", n.Fees)
	appendMoneyChange(pv, "taxes", n.Taxes)
	appendMoneyChange(pv, "net", &net)

	// The record splits the costs over the orders before it converts each one (FC3, FC9).
	shares, err := noteCostShares(n, cash.Currency(), grosses, saleGrosses)

	return append(plus, shares...), minus, err
}

// noteCostShares splits the fees over the gross of every order and the taxes over the gross of the
// sales, as the record of the note does.
func noteCostShares(
	n app.BrokerageNote,
	currency money.Currency,
	grosses, saleGrosses []int64,
) ([]*money.Money, error) {
	var out []*money.Money

	for _, part := range []struct {
		total   *money.Money
		weights []int64
	}{{n.Fees, grosses}, {n.Taxes, saleGrosses}} {
		if part.total == nil || part.total.IsZero() {
			continue
		}

		for _, a := range domain.Apportion(part.total.Amount(), part.weights) {
			m, err := money.New(a, currency)
			if err != nil {
				return nil, err
			}

			out = append(out, &m)
		}
	}

	return out, nil
}

// appendNoteSettlement states the day every order settles, or the day of each one on its item.
func appendNoteSettlement(
	ctx context.Context,
	svc *app.Service,
	pv *tool.Preview,
	n app.BrokerageNote,
) error {
	days := make([]tool.Value, len(n.Orders))

	for i, o := range n.Orders {
		day, err := svc.SettlementDate(ctx, o.Instrument, n.Date, n.SettlementDate)
		if err != nil {
			return err
		}

		days[i] = tool.DateValue(day)
	}

	if distinct := slices.Compact(slices.Clone(days)); len(distinct) == 1 {
		pv.Changes = append(pv.Changes, tool.Change{Field: "settlement", After: distinct[0]})

		return nil
	}

	for i, day := range days {
		pv.Items[i].Date = day.Date
	}

	return nil
}

func optionalAmount(field, text string, unit money.Money) (*money.Money, error) {
	if text == "" {
		return nil, nil
	}

	m, err := tool.ParsePositive(field, text, unit)

	return &m, err
}
