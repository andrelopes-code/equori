package domain

import (
	"bytes"
	"cmp"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// MaxFileLines is the most lines an investment file holds after its header (IF2).
const MaxFileLines = 10000

var investmentFileHeader = []string{
	"kind", "date", "instrument", "quantity", "unit_price", "fees", "taxes", "gross", "withheld",
	"income_type", "exchange_rate",
}

// FileLine is one record of an investment file; the decimals stay text until the app reads them
// with the scale of the instrument and of the currency of the line. An empty cell is an empty
// string.
type FileLine struct {
	Line                                                                        int
	Kind                                                                        string
	Date                                                                        time.Time
	Instrument                                                                  money.Currency
	Quantity, UnitPrice, Fees, Taxes, Gross, Withheld, IncomeType, ExchangeRate string
}

// ParseInvestmentFile reads an investment file; errors name the line, the header being line 1
// (investment history IF2, IF3).
func ParseInvestmentFile(content []byte) ([]FileLine, error) {
	r := csv.NewReader(bytes.NewReader(content))
	r.FieldsPerRecord = len(investmentFileHeader)

	header, err := r.Read()
	if err != nil || !slices.Equal(header, investmentFileHeader) {
		return nil, invalid(
			"line 1",
			"must be the header kind,date,instrument,quantity,unit_price,fees,taxes,"+
				"gross,withheld,income_type,exchange_rate",
		)
	}

	var out []FileLine

	for line := 2; ; line++ {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			break
		}

		field := fmt.Sprintf("line %d", line)
		if err != nil {
			return nil, invalid(field, "must have eleven comma-separated values")
		}

		if len(out) == MaxFileLines {
			return nil, invalid("file", fmt.Sprintf("must have at most %d lines", MaxFileLines))
		}

		l, err := fileLine(line, rec)
		if err != nil {
			return nil, invalid(field, err.Error())
		}

		out = append(out, l)
	}

	if len(out) == 0 {
		return nil, invalid("file", "has no lines")
	}

	return out, nil
}

func fileLine(line int, rec []string) (FileLine, error) {
	switch rec[0] {
	case "opening", "buy", "sell", "income":
	default:
		return FileLine{}, errors.New("kind must be opening, buy, sell or income")
	}

	date, err := time.Parse(time.DateOnly, rec[1])
	if err != nil {
		return FileLine{}, errors.New("date must be YYYY-MM-DD")
	}

	return FileLine{
		Line: line, Kind: rec[0], Date: date, Instrument: money.Currency(rec[2]),
		Quantity: rec[3], UnitPrice: rec[4], Fees: rec[5], Taxes: rec[6], Gross: rec[7],
		Withheld: rec[8], IncomeType: rec[9], ExchangeRate: rec[10],
	}, nil
}

// FileOrders turns the lines of one file into orders: the brokerage and the accounts the file
// takes are shared by every line. Base is the base currency; Cash is the currency of the cash
// account of the import (Base when the file has no cash line), the currency of the amounts of its
// buy, sell and income lines (foreign cash FC10).
type FileOrders struct {
	BrokerageID, CashAccountID, CategoryID uuid.UUID
	Base, Cash                             money.Currency
}

// Trade reads an opening, buy or sell line; code and scale are those of its instrument and quote
// is its quote currency. An opening takes no cash account and its amounts are in the quote
// currency (FC7).
func (o FileOrders) Trade(
	l FileLine,
	code money.Currency,
	scale int,
	quote money.Currency,
) (TradeOrder, error) {
	quantity, err := fileDecimal("quantity", l.Quantity, code, scale)
	if err != nil {
		return TradeOrder{}, err
	}

	price, err := money.ParseRate(l.UnitPrice)
	if err != nil {
		return TradeOrder{}, invalid(
			"unit_price",
			"must be a positive decimal with at most 12 decimals",
		)
	}

	currency := o.Cash
	if l.Kind == "opening" {
		currency = cmp.Or(quote, o.Base)
	}

	fees, err := optionalAmount("fees", l.Fees, currency)
	if err != nil {
		return TradeOrder{}, err
	}

	taxes, err := optionalAmount("taxes", l.Taxes, currency)
	if err != nil {
		return TradeOrder{}, err
	}

	rate, err := fileRate(l.ExchangeRate)
	if err != nil {
		return TradeOrder{}, err
	}

	order := TradeOrder{
		BrokerageID: o.BrokerageID, Instrument: code, Side: Side(l.Kind), Date: l.Date,
		Quantity: quantity, UnitPrice: price, Fees: fees, Taxes: taxes, ExchangeRate: rate,
	}
	if l.Kind != "opening" {
		order.CashAccountID = o.CashAccountID
	}

	return order, nil
}

// Income reads an income line; an empty withheld is zero (IF3).
func (o FileOrders) Income(l FileLine, code money.Currency) (IncomeOrder, error) {
	gross, err := fileAmount("gross", l.Gross, o.Cash)
	if err != nil {
		return IncomeOrder{}, err
	}

	withheld, err := fileAmount("withheld", cmp.Or(l.Withheld, "0"), o.Cash)
	if err != nil {
		return IncomeOrder{}, err
	}

	rate, err := fileRate(l.ExchangeRate)
	if err != nil {
		return IncomeOrder{}, err
	}

	return IncomeOrder{
		BrokerageID: o.BrokerageID, Instrument: code, CategoryID: o.CategoryID,
		CashAccountID: o.CashAccountID, Type: IncomeType(l.IncomeType), Date: l.Date,
		Gross: gross, Withheld: &withheld, ExchangeRate: rate,
	}, nil
}

// fileRate reads the optional exchange_rate cell of a line.
func fileRate(text string) (*money.Rate, error) {
	if text == "" {
		return nil, nil
	}

	rate, err := money.ParseRate(text)
	if err != nil {
		return nil, invalid("exchange_rate", "must be a positive decimal with at most 12 decimals")
	}

	return &rate, nil
}

func optionalAmount(field, text string, currency money.Currency) (*money.Money, error) {
	if text == "" {
		return nil, nil
	}

	m, err := fileAmount(field, text, currency)
	if err != nil {
		return nil, err
	}

	return &m, nil
}

// fileAmount reads text as an amount of currency, with the decimals of the currency.
func fileAmount(field, text string, currency money.Currency) (money.Money, error) {
	zero, err := money.New(0, currency)
	if err != nil {
		return money.Money{}, invalid(field, "must be an amount of "+string(currency))
	}

	return fileDecimal(field, text, currency, zero.Scale())
}

func fileDecimal(field, text string, code money.Currency, scale int) (money.Money, error) {
	if text == "" {
		return money.Money{}, invalid(field, "is required")
	}

	m, err := money.ParseDecimal(text, code, scale)
	if err != nil {
		return money.Money{}, invalid(
			field,
			fmt.Sprintf("must be a decimal with at most %d decimals", scale),
		)
	}

	return m, nil
}
