package domain

import (
	"maps"
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

const TypeCurrency = "currency"

// SecurityTypes are the instrument types other than currency.
var SecurityTypes = []string{
	"stock",
	"etf",
	"reit",
	"depositary_receipt",
	"fixed_income",
	"fund",
	"crypto",
}

// ReclassifiableTypes are the types a security changes among: the same scale, no terms and the
// same price sources (A224).
var ReclassifiableTypes = []string{"stock", "etf", "reit", "depositary_receipt"}

var micPattern = regexp.MustCompile(`^[A-Z0-9]{4}$`)

var subtypePattern = regexp.MustCompile(`^[a-z0-9_]{2,40}$`)

var codePattern = regexp.MustCompile(`^[A-Z0-9.]{2,20}$`)

var symbolPattern = regexp.MustCompile("^[A-Za-z0-9.=^_-]{1,40}$")

type Instrument struct {
	Code          money.Currency
	Type          string
	Scale         int
	Name          string
	QuoteCurrency money.Currency    // empty for currencies
	Exchange      string            // ISO 10383 MIC or empty
	Subtype       string            // refines Type for the owner's jurisdiction; empty when none
	Symbols       map[string]string // source ID to symbol; nil when none (A222 MQ20)
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
	case in.Exchange != "" && !micPattern.MatchString(in.Exchange):
		return in, invalid("exchange", "must be an ISO 10383 MIC")
	case in.Subtype != "" && !subtypePattern.MatchString(in.Subtype):
		return in, invalid("subtype", "must match ^[a-z0-9_]{2,40}$")
	}

	for _, key := range slices.Sorted(maps.Keys(in.Symbols)) {
		if !symbolPattern.MatchString(in.Symbols[key]) {
			return in, invalid("symbols."+key, "must match ^[A-Za-z0-9.=^_-]{1,40}$")
		}
	}

	return in, nil
}

// Reclassify returns in with type to. Both types must be in ReclassifiableTypes, unless they are
// equal (A224).
func (in Instrument) Reclassify(to string) (Instrument, error) {
	if to == "" || to == in.Type {
		return in, nil
	}

	if !slices.Contains(ReclassifiableTypes, in.Type) || !slices.Contains(ReclassifiableTypes, to) {
		return in, invalid("type", "can change only among stock, etf, reit and depositary_receipt")
	}

	in.Type = to

	return in, nil
}

// ValidSecurityCode reports whether code can name a security: the code pattern, and no currency.
func ValidSecurityCode(code money.Currency) bool {
	return codePattern.MatchString(string(code)) && !isCurrency(code)
}

func isCurrency(code money.Currency) bool {
	_, err := money.ParseCurrency(string(code))
	return err == nil
}
