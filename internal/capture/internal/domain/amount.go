package domain

import (
	"regexp"
	"strconv"
	"strings"
)

// decimal is a number read from text: mantissa × 10^−exp.
type decimal struct {
	mantissa int64
	exp      int
}

// The number forms of A108; the three are disjoint.
var (
	plainNumber   = regexp.MustCompile(`^[0-9]+(,[0-9]+)?$`)
	groupedNumber = regexp.MustCompile(`^[0-9]{1,3}(\.[0-9]{3})+(,[0-9]+)?$`)
	dottedNumber  = regexp.MustCompile(`^[0-9]+\.[0-9]{1,2}$`)
)

// maxDigits keeps every mantissa, and a mantissa times a multiplier, inside int64.
const maxDigits = 15

// maxUnits is the largest whole amount a line may carry (A108).
const maxUnits = 999_999_999

func parseNumber(s string) (decimal, bool) {
	var whole, frac string
	switch {
	case plainNumber.MatchString(s), groupedNumber.MatchString(s):
		whole, frac, _ = strings.Cut(s, ",")
		whole = strings.ReplaceAll(whole, ".", "")
	case dottedNumber.MatchString(s):
		whole, frac, _ = strings.Cut(s, ".")
	default:
		return decimal{}, false
	}
	digits := strings.TrimLeft(whole+frac, "0")
	if len(digits) > maxDigits {
		return decimal{}, false
	}
	m, err := strconv.ParseInt("0"+digits, 10, 64)
	if err != nil {
		return decimal{}, false
	}
	return decimal{mantissa: m, exp: len(frac)}, true
}

// times multiplies d by a small factor; maxDigits leaves room for 10⁴ and the 420 of A110.
func (d decimal) times(n int64) decimal {
	return decimal{mantissa: d.mantissa * n, exp: d.exp}
}

// minor returns d in minor units of an instrument with scale decimal places; false when d
// has more significant decimal places than scale, is zero, or exceeds maxUnits.
func (d decimal) minor(scale int) (int64, bool) {
	m, exp := d.mantissa, d.exp
	for exp > scale && m%10 == 0 {
		m, exp = m/10, exp-1
	}
	if exp > scale || m == 0 {
		return 0, false
	}
	for ; exp < scale; exp++ {
		m *= 10
	}
	limit := int64(maxUnits)
	for range scale {
		limit = limit*10 + 9
	}
	if m > limit {
		return 0, false
	}
	return m, true
}

// amountPhrase is a number with its prefix, sign and multiplier.
type amountPhrase struct {
	value decimal
	// explicit marks a phrase with R$, a sign, a multiplier or the word reais.
	explicit bool
	sign     int
	words    int
}

// readAmount reads the amount phrase that starts at free word i.
func readAmount(ws []word, i int, lex Lexicon) (amountPhrase, bool) {
	var p amountPhrase
	s := ws[i].norm
	p.words = 1
	s, p.sign = cutSign(s)
	if rest, ok := lex.cutSymbol(s); ok {
		s = rest
		p.explicit = true
		if p.sign == 0 {
			s, p.sign = cutSign(s)
		}
	}
	if p.sign != 0 {
		p.explicit = true
	}
	if s == "" {
		if !p.explicit || i+1 >= len(ws) || !ws[i+1].free() {
			return amountPhrase{}, false
		}
		s = ws[i+1].norm
		p.words = 2
	}
	factor := int64(1)
	if rest, f, ok := lex.cutSuffixFactor(s); ok {
		s, factor, p.explicit = rest, f, true
	}
	v, ok := parseNumber(s)
	if !ok {
		return amountPhrase{}, false
	}
	if j := i + p.words; factor == 1 && j < len(ws) && ws[j].free() {
		if f, ok := lex.wordFactor(ws[j].norm); ok {
			factor, p.explicit = f, true
			p.words++
		}
	}
	if j := i + p.words; j < len(ws) && ws[j].free() {
		if _, ok := lex.CurrencyWords[ws[j].norm]; ok {
			p.explicit = true
			p.words++
		}
	}
	p.value = v.times(factor)
	return p, true
}

func cutSign(s string) (string, int) {
	switch {
	case strings.HasPrefix(s, "+"):
		return s[1:], 1
	case strings.HasPrefix(s, "-"):
		return s[1:], -1
	}
	return s, 0
}
