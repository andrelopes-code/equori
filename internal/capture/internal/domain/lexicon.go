package domain

import (
	"maps"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Lexicon holds the words of one language that a line may use. Every key and word is normalized.
type Lexicon struct {
	Language string
	DaysBack map[string]int
	Weekdays map[string]time.Weekday
	// Multipliers maps a one-letter suffix ("k") or a following word ("mil") to its factor.
	Multipliers     map[string]int64
	CurrencyWords   map[string]money.Currency
	CurrencySymbols map[string]money.Currency
	CountWords      []string
	// InstallmentLeads precede an installment count; the last one is the connective that
	// does not mark the phrase as parcelled.
	InstallmentLeads []string
	LumpSum          [][]string
	Of               []string
	Destination      []string
	Source           []string
	Methods          map[string]method
}

// Merge returns the union of both lexicons; an entry of primary wins over the same key of fallback.
func Merge(primary, fallback Lexicon) Lexicon {
	out := Lexicon{
		Language:         primary.Language,
		DaysBack:         mergeMap(primary.DaysBack, fallback.DaysBack),
		Weekdays:         mergeMap(primary.Weekdays, fallback.Weekdays),
		Multipliers:      mergeMap(primary.Multipliers, fallback.Multipliers),
		CurrencyWords:    mergeMap(primary.CurrencyWords, fallback.CurrencyWords),
		CurrencySymbols:  mergeMap(primary.CurrencySymbols, fallback.CurrencySymbols),
		CountWords:       mergeList(primary.CountWords, fallback.CountWords),
		InstallmentLeads: mergeList(primary.InstallmentLeads, fallback.InstallmentLeads),
		Of:               mergeList(primary.Of, fallback.Of),
		Destination:      mergeList(primary.Destination, fallback.Destination),
		Source:           mergeList(primary.Source, fallback.Source),
		Methods:          mergeMap(primary.Methods, fallback.Methods),
	}
	for _, phrase := range append(slices.Clone(primary.LumpSum), fallback.LumpSum...) {
		if !slices.ContainsFunc(out.LumpSum, func(p []string) bool { return slices.Equal(p, phrase) }) {
			out.LumpSum = append(out.LumpSum, slices.Clone(phrase))
		}
	}
	return out
}

func mergeMap[K comparable, V any](primary, fallback map[K]V) map[K]V {
	out := maps.Clone(fallback)
	if out == nil {
		out = map[K]V{}
	}
	maps.Copy(out, primary)
	return out
}

func mergeList(primary, fallback []string) []string {
	out := slices.Clone(primary)
	for _, w := range fallback {
		if !slices.Contains(out, w) {
			out = append(out, w)
		}
	}
	return out
}

func (l Lexicon) isLumpSum(words ...string) bool {
	return slices.ContainsFunc(l.LumpSum, func(p []string) bool { return slices.Equal(p, words) })
}

// cutSymbol removes a currency symbol prefix from s.
func (l Lexicon) cutSymbol(s string) (string, bool) {
	for sym := range l.CurrencySymbols {
		if rest, ok := strings.CutPrefix(s, sym); ok {
			return rest, true
		}
	}
	return s, false
}

// cutSuffixFactor removes a one-letter multiplier suffix from s.
func (l Lexicon) cutSuffixFactor(s string) (string, int64, bool) {
	for k, f := range l.Multipliers {
		if len(k) != 1 {
			continue
		}
		if rest, ok := strings.CutSuffix(s, k); ok {
			return rest, f, true
		}
	}
	return s, 1, false
}

// wordFactor returns the factor of a multiplier word that follows a number.
func (l Lexicon) wordFactor(w string) (int64, bool) {
	if len(w) == 1 {
		return 0, false
	}
	f, ok := l.Multipliers[w]
	return f, ok
}
