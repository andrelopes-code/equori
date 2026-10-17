package domain

import (
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

const TypeCurrency = "currency"

// SecurityTypes are the tax classes of 5.6 other than currency.
var SecurityTypes = []string{"stock", "fii", "etf", "bdr", "fixed_income", "fund", "crypto"}

var codePattern = regexp.MustCompile(`^[A-Z0-9.]{2,20}$`)

type Instrument struct {
	Code          money.Currency
	Type          string
	Scale         int
	Name          string
	QuoteCurrency money.Currency // empty for currencies
	Exchange      string         // "B3" or empty
}

// Validate checks a security definition (P8 amendment A59); the quote currency is
// checked against the stored instruments by the caller.
func (in Instrument) Validate() (Instrument, error) {
	in.Name = strings.TrimSpace(in.Name)
	switch {
	case !codePattern.MatchString(string(in.Code)):
		return in, invalid("code", "must match ^[A-Z0-9.]{2,20}$")
	case isCurrency(in.Code):
		return in, invalid("code", "is a currency code")
	case !slices.Contains(SecurityTypes, in.Type):
		return in, invalid("type", "must be a security type")
	case in.Scale < 0 || in.Scale > money.MaxScale:
		return in, invalid("scale", "must be between 0 and 12")
	case in.Name == "" || utf8.RuneCountInString(in.Name) > 120:
		return in, invalid("name", "must have 1 to 120 characters")
	case in.Exchange != "" && in.Exchange != "B3":
		return in, invalid("exchange", "must be B3")
	}
	return in, nil
}

func isCurrency(code money.Currency) bool {
	_, err := money.ParseCurrency(string(code))
	return err == nil
}
