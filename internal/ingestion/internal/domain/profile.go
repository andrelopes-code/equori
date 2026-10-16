package domain

import (
	"strconv"
	"time"

	"github.com/google/uuid"
)

type DateLayout string

const (
	LayoutDayMonthYear DateLayout = "DD/MM/YYYY"
	LayoutISO          DateLayout = "YYYY-MM-DD"
	LayoutMonthDayYear DateLayout = "MM/DD/YYYY"
)

// GoLayout is the time.Parse layout of the date layout.
func (l DateLayout) GoLayout() string {
	switch l {
	case LayoutDayMonthYear:
		return "02/01/2006"
	case LayoutMonthDayYear:
		return "01/02/2006"
	default:
		return time.DateOnly
	}
}

type AmountSign string

const (
	SignAsIs     AmountSign = "as_is"
	SignInverted AmountSign = "inverted"
)

// Profile says how the CSV files of one account are read (P4 amendment A13). Columns are
// header names, or 1-based positions when the file has no header row.
type Profile struct {
	UserID            int64
	AccountID         uuid.UUID
	Delimiter         string
	HeaderRows        int
	DateColumn        string
	DateLayout        DateLayout
	AmountColumn      string
	DebitColumn       string
	CreditColumn      string
	DecimalSeparator  string
	DescriptionColumn string
	IDColumn          string
	AmountSign        AmountSign
}

// NewProfile applies defaults (comma delimiter, one header row, amounts as they are) and
// validates the profile.
func NewProfile(p Profile) (Profile, error) {
	if p.Delimiter == "" {
		p.Delimiter = ","
	}
	if p.AmountSign == "" {
		p.AmountSign = SignAsIs
	}
	switch {
	case p.Delimiter != "," && p.Delimiter != ";" && p.Delimiter != "\t" && p.Delimiter != "|":
		return Profile{}, invalid("delimiter", `must be ",", ";", tab or "|"`)
	case p.HeaderRows < 0 || p.HeaderRows > 10:
		return Profile{}, invalid("header_rows", "must be between 0 and 10")
	case p.DateLayout != LayoutDayMonthYear && p.DateLayout != LayoutISO && p.DateLayout != LayoutMonthDayYear:
		return Profile{}, invalid("date_layout", "must be DD/MM/YYYY, YYYY-MM-DD or MM/DD/YYYY")
	case p.DecimalSeparator != "," && p.DecimalSeparator != ".":
		return Profile{}, invalid("decimal_separator", `must be "," or "."`)
	case p.AmountSign != SignAsIs && p.AmountSign != SignInverted:
		return Profile{}, invalid("amount_sign", "must be as_is or inverted")
	case (p.DebitColumn == "") != (p.CreditColumn == ""):
		return Profile{}, invalid("credit_column", "debit_column and credit_column go together")
	case (p.AmountColumn == "") == (p.DebitColumn == ""):
		return Profile{}, invalid("amount_column", "set amount_column, or debit_column and credit_column")
	}
	columns := map[string]string{
		"date_column": p.DateColumn, "description_column": p.DescriptionColumn, "amount_column": p.AmountColumn,
		"debit_column": p.DebitColumn, "credit_column": p.CreditColumn, "id_column": p.IDColumn,
	}
	for _, field := range []string{"date_column", "description_column", "amount_column", "debit_column", "credit_column", "id_column"} {
		c := columns[field]
		required := field == "date_column" || field == "description_column"
		if c == "" {
			if required {
				return Profile{}, invalid(field, "is required")
			}
			continue
		}
		if p.HeaderRows == 0 {
			if n, err := strconv.Atoi(c); err != nil || n < 1 {
				return Profile{}, invalid(field, "must be a column position from 1 when the file has no header row")
			}
		}
	}
	return p, nil
}
