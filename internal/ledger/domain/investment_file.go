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
	"income_type",
}

// FileLine is one record of an investment file; the decimals stay text until the app reads them
// with the scale of the instrument and the base currency. An empty cell is an empty string.
type FileLine struct {
	Line                                                          int
	Kind                                                          string
	Date                                                          time.Time
	Instrument                                                    money.Currency
	Quantity, UnitPrice, Fees, Taxes, Gross, Withheld, IncomeType string
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
				"gross,withheld,income_type",
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
			return nil, invalid(field, "must have ten comma-separated values")
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
		Withheld: rec[8], IncomeType: rec[9],
	}, nil
}

// FileOrders turns the lines of one file into orders: the brokerage, the accounts the file takes
// and the base currency with its scale are shared by every line.
type FileOrders struct {
	BrokerageID, CashAccountID, CategoryID uuid.UUID
	Base                                   money.Currency
	Scale                                  int
}

// Trade reads an opening, buy or sell line; code and scale are those of its instrument. An
// opening takes no cash account.
func (o FileOrders) Trade(l FileLine, code money.Currency, scale int) (TradeOrder, error) {
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

	fees, err := o.optional("fees", l.Fees)
	if err != nil {
		return TradeOrder{}, err
	}

	taxes, err := o.optional("taxes", l.Taxes)
	if err != nil {
		return TradeOrder{}, err
	}

	order := TradeOrder{
		BrokerageID: o.BrokerageID, Instrument: code, Side: Side(l.Kind), Date: l.Date,
		Quantity: quantity, UnitPrice: price, Fees: fees, Taxes: taxes,
	}
	if l.Kind != "opening" {
		order.CashAccountID = o.CashAccountID
	}

	return order, nil
}

// Income reads an income line; an empty withheld is zero (IF3).
func (o FileOrders) Income(l FileLine, code money.Currency) (IncomeOrder, error) {
	gross, err := fileDecimal("gross", l.Gross, o.Base, o.Scale)
	if err != nil {
		return IncomeOrder{}, err
	}

	withheld, err := fileDecimal("withheld", cmp.Or(l.Withheld, "0"), o.Base, o.Scale)
	if err != nil {
		return IncomeOrder{}, err
	}

	return IncomeOrder{
		BrokerageID: o.BrokerageID, Instrument: code, CategoryID: o.CategoryID,
		CashAccountID: o.CashAccountID, Type: IncomeType(l.IncomeType), Date: l.Date,
		Gross: gross, Withheld: &withheld,
	}, nil
}

func (o FileOrders) optional(field, text string) (*money.Money, error) {
	if text == "" {
		return nil, nil
	}

	m, err := fileDecimal(field, text, o.Base, o.Scale)
	if err != nil {
		return nil, err
	}

	return &m, nil
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
