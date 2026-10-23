package money

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var ErrInvalidDecimal = errors.New("invalid decimal amount")

var decimalPattern = regexp.MustCompile(`^(-?)([0-9]{1,16})(?:\.([0-9]+))?$`)

// ParseDecimal reads a decimal string such as "-125.90" with at most scale fraction digits.
func ParseDecimal(s string, code Currency, scale int) (Money, error) {
	m := decimalPattern.FindStringSubmatch(s)
	if m == nil || len(m[3]) > scale {
		return Money{}, fmt.Errorf("%w: %q with at most %d decimals", ErrInvalidDecimal, s, scale)
	}
	digits := m[2] + m[3] + strings.Repeat("0", scale-len(m[3]))
	n, err := strconv.ParseInt(m[1]+digits, 10, 64)
	if err != nil {
		return Money{}, ErrOutOfRange
	}
	return NewOf(n, code, scale)
}
