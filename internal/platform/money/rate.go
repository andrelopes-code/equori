package money

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var ErrInvalidRate = errors.New("invalid rate")

var ratePattern = regexp.MustCompile(`^[0-9]+(\.[0-9]{1,12})?$`)

// Rate is a positive exact decimal: mantissa × 10^-scale (chapter 5, 5.1). Prices and
// exchange rates are rates; the zero value is invalid.
type Rate struct {
	mantissa int64
	scale    int8
}

func NewRate(mantissa int64, scale int) (Rate, error) {
	if mantissa <= 0 || scale < 0 || scale > MaxScale {
		return Rate{}, fmt.Errorf("%w: %d with scale %d", ErrInvalidRate, mantissa, scale)
	}
	return Rate{mantissa: mantissa, scale: int8(scale)}, nil
}

// ParseRate reads a plain decimal such as "5.4830"; the number of decimals is kept.
func ParseRate(s string) (Rate, error) {
	if !ratePattern.MatchString(s) {
		return Rate{}, fmt.Errorf("%w: %q", ErrInvalidRate, s)
	}
	whole, frac, _ := strings.Cut(s, ".")
	mantissa, err := strconv.ParseInt(whole+frac, 10, 64)
	if err != nil {
		return Rate{}, fmt.Errorf("%w: %q", ErrInvalidRate, s)
	}
	return NewRate(mantissa, len(frac))
}

func (r Rate) Mantissa() int64 { return r.mantissa }
func (r Rate) Scale() int      { return int(r.scale) }

func (r Rate) String() string {
	digits := strconv.FormatInt(r.mantissa, 10)
	if r.scale == 0 {
		return digits
	}
	for len(digits) <= int(r.scale) {
		digits = "0" + digits
	}
	cut := len(digits) - int(r.scale)
	return digits[:cut] + "." + digits[cut:]
}

// Reduced drops trailing zero decimals: 5.5000 becomes 5.5, the form a stored rate reads back as.
func (r Rate) Reduced() Rate {
	for r.scale > 0 && r.mantissa%10 == 0 {
		r.mantissa /= 10
		r.scale--
	}
	return r
}
