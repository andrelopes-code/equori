package domain

import (
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

var groupSeparators = []string{",", ".", " ", "\u00a0", "'", ""}

var encodingName = regexp.MustCompile(`^[a-z0-9_-]{2,40}$`)

// DateLayout names the order and separator of a date: three of DD, MM and YYYY (or YY),
// each of day, month and year once, joined by one of "/", ".", "-" or " ".
type DateLayout string

const (
	LayoutDayMonthYear DateLayout = "DD/MM/YYYY"
	LayoutISO          DateLayout = "YYYY-MM-DD"
	LayoutMonthDayYear DateLayout = "MM/DD/YYYY"
)

var goTokens = map[string]string{"DD": "02", "MM": "01", "YYYY": "2006", "YY": "06"}

// GoLayout is the time.Parse layout of the date layout, or "" when the layout is invalid.
func (l DateLayout) GoLayout() string {
	s := string(l)
	if len(s) < 8 {
		return ""
	}
	sep := ""
	for _, r := range []string{"/", ".", "-", " "} {
		if strings.Count(s, r) == 2 {
			sep = r
		}
	}
	parts := strings.Split(s, sep)
	if sep == "" || len(parts) != 3 {
		return ""
	}
	var day, month, year int
	out := make([]string, 3)
	for i, p := range parts {
		g, ok := goTokens[p]
		if !ok {
			return ""
		}
		out[i] = g
		switch p {
		case "DD":
			day++
		case "MM":
			month++
		default:
			year++
		}
	}
	if day != 1 || month != 1 || year != 1 {
		return ""
	}
	return strings.Join(out, sep)
}

// Parse reads a date written in the layout.
func (l DateLayout) Parse(s string) (time.Time, error) {
	g := l.GoLayout()
	if g == "" {
		return time.Time{}, fmt.Errorf("invalid date layout %q", string(l))
	}
	return time.Parse(g, s)
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
	Encoding          string
	GroupSeparator    string
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
	if p.Encoding == "" {
		p.Encoding = "auto"
	}
	switch {
	case p.Delimiter != "," && p.Delimiter != ";" && p.Delimiter != "\t" && p.Delimiter != "|":
		return Profile{}, invalid("delimiter", `must be ",", ";", tab or "|"`)
	case p.HeaderRows < 0 || p.HeaderRows > 10:
		return Profile{}, invalid("header_rows", "must be between 0 and 10")
	case p.DateLayout.GoLayout() == "":
		return Profile{}, invalid("date_layout", `must hold DD, MM and YYYY or YY once each, joined by "/", ".", "-" or " "`)
	case p.DecimalSeparator != "," && p.DecimalSeparator != ".":
		return Profile{}, invalid("decimal_separator", `must be "," or "."`)
	case !slices.Contains(groupSeparators, p.GroupSeparator) || p.GroupSeparator == p.DecimalSeparator && p.GroupSeparator != "":
		return Profile{}, invalid("group_separator", `must be "," , ".", a space, a no-break space, "'" or empty, and differ from decimal_separator`)
	case !encodingName.MatchString(p.Encoding):
		return Profile{}, invalid("encoding", "must match ^[a-z0-9_-]{2,40}$")
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
