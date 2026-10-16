package domain

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// MinorUnits converts a written amount to minor units with scale decimals. decimal is the
// decimal separator; the other of '.' and ',' is a thousands separator and is removed,
// as are spaces and a leading "R$".
func MinorUnits(s string, decimal rune, scale int) (int64, error) {
	thousands := ","
	if decimal == ',' {
		thousands = "."
	}
	v := strings.NewReplacer(" ", "", " ", "", "R$", "", thousands, "").Replace(strings.TrimSpace(s))
	if v == "" {
		return 0, errors.New("missing amount")
	}
	sign := int64(1)
	switch v[0] {
	case '-':
		sign, v = -1, v[1:]
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
	return sign * n, nil
}
