package domain

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

func isAffix(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsSpace(r) || unicode.Is(unicode.Sc, r)
}

// MinorUnits converts a written amount to minor units with scale decimals. decimal is the
// decimal separator and group the digit group separator (0 for none); spaces are always
// removed. A currency symbol or code before or after the number is ignored. Parentheses
// around the number or a trailing minus sign make it negative.
func MinorUnits(s string, decimal, group rune, scale int) (int64, error) {
	v := strings.TrimFunc(s, isAffix)
	negative := false
	if strings.HasPrefix(v, "(") && strings.HasSuffix(v, ")") {
		v, negative = strings.TrimFunc(v[1:len(v)-1], isAffix), true
	}
	if strings.HasSuffix(v, "-") {
		v, negative = strings.TrimFunc(v[:len(v)-1], isAffix), true
	}
	v = strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) || (group != 0 && r == group) {
			return -1
		}
		return r
	}, v)
	if v == "" {
		return 0, errors.New("missing amount")
	}
	switch v[0] {
	case '-':
		if negative {
			return 0, fmt.Errorf("%q is not an amount", s)
		}
		negative, v = true, v[1:]
	case '+':
		v = v[1:]
	}
	whole, frac, _ := strings.Cut(v, string(decimal))
	frac = strings.TrimRight(frac, "0")
	if whole == "" || len(frac) > scale || strings.ContainsAny(whole+frac, ".,+-") {
		return 0, fmt.Errorf("%q is not an amount with at most %d decimals", s, scale)
	}
	n, err := strconv.ParseInt(whole+frac+strings.Repeat("0", scale-len(frac)), 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%q is not an amount", s)
	}
	if negative {
		n = -n
	}
	return n, nil
}
