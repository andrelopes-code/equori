package domain

import (
	"cmp"
	"slices"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/textfold"
)

// Record matching by score (amendments A98–A100): a Fellegi–Sunter comparison with fixed
// integer weights and two thresholds.
const (
	// MatchHardLimit is the largest distance in days between a line and a posting it may
	// confirm (A98).
	MatchHardLimit = 10
	// LinkScore and ReviewScore are the upper and lower thresholds (A100).
	LinkScore   = 8
	ReviewScore = 4
	// LinkMargin is the lead the best candidate needs over the others to link (A100).
	LinkMargin = 3

	amountBoundPercent = 20
	smallAmount        = 500 // 5.00 in minor units of a two-decimal currency
	smallAmountBound   = 100
	overlapPercent     = 50
)

// LedgerPosting is a posting of the account that no external record confirms yet.
type LedgerPosting struct {
	TransactionID uuid.UUID
	Date          time.Time
	Amount        int64
	PayeeID       uuid.UUID
	Description   string
	// StatementID is the card statement of the posting, uuid.Nil without one.
	StatementID uuid.UUID
}

// MatchLine is what matching compares of a statement line; PayeeID is the payee
// classification decides for it.
type MatchLine struct {
	Date        time.Time
	Amount      int64
	PayeeID     uuid.UUID
	Description string
}

// Outcomes of each comparison (A99), kept on a record in review.
const (
	AmountIdentical = "identical"
	AmountClose     = "close"
	AmountBounded   = "bounded"
	DateSameDay     = "same_day"
	DateNear        = "near"
	DateFar         = "far"
	PayeeSame       = "same_payee"
	PayeeOther      = "other_payee"
	PayeeSimilar    = "similar_description"
	PayeeUnknown    = "unknown"
)

// Scored is one candidate posting with its score and the outcome of each comparison.
type Scored struct {
	TransactionID uuid.UUID
	Score         int
	Amount        string
	Date          string
	Counterparty  string
	days          int
}

type Zone string

const (
	ZoneLink      Zone = "link"
	ZoneProbable  Zone = "probable"
	ZoneAmbiguous Zone = "ambiguous"
	ZoneNew       Zone = "new"
)

// Assignment is the decision for one line: the posting it links, or the candidates a review
// shows, best first.
type Assignment struct {
	Zone          Zone
	TransactionID uuid.UUID
	Candidates    []Scored
}

// Score compares a line with a posting; false when the blocking of A98 excludes the pair.
func Score(l MatchLine, p LedgerPosting) (Scored, bool) {
	if (l.Amount < 0) != (p.Amount < 0) || l.Amount == 0 {
		return Scored{}, false
	}
	days := int(p.Date.Sub(l.Date).Hours() / 24)
	days = max(days, -days)
	diff := abs(l.Amount - p.Amount)
	base := abs(l.Amount)
	inBound := diff*100 <= base*amountBoundPercent || (base < smallAmount && diff <= smallAmountBound)
	if days > MatchHardLimit || !inBound {
		return Scored{}, false
	}
	s := Scored{TransactionID: p.TransactionID, days: days}
	switch {
	case diff == 0:
		s.Score, s.Amount = 6, AmountIdentical
	case diff*100 <= base:
		s.Score, s.Amount = 3, AmountClose
	default:
		s.Score, s.Amount = -2, AmountBounded
	}
	switch {
	case days == 0:
		s.Score, s.Date = s.Score+3, DateSameDay
	case days <= 3:
		s.Score, s.Date = s.Score+2, DateNear
	default:
		s.Score, s.Date = s.Score-1, DateFar
	}
	switch {
	case l.PayeeID != uuid.Nil && p.PayeeID != uuid.Nil && l.PayeeID == p.PayeeID:
		s.Score, s.Counterparty = s.Score+4, PayeeSame
	case l.PayeeID != uuid.Nil && p.PayeeID != uuid.Nil:
		s.Score, s.Counterparty = s.Score-6, PayeeOther
	case overlaps(l.Description, p.Description):
		s.Score, s.Counterparty = s.Score+2, PayeeSimilar
	default:
		s.Counterparty = PayeeUnknown
	}
	return s, true
}

// Assign decides every line (A100). Lines are settled in the order of their best score, so a
// posting goes to the line that scores it highest; a linked posting leaves the candidates of
// the lines settled after it. A line in review takes no posting. Each pair is scored once.
func Assign(lines []MatchLine, postings []LedgerPosting) []Assignment {
	out := make([]Assignment, len(lines))
	scored := make([][]Scored, len(lines))
	for i, l := range lines {
		scored[i] = candidates(l, postings)
	}
	taken := map[uuid.UUID]bool{}
	// first[i] is the index of line i's best candidate not taken; taken only grows, so it
	// only moves forward.
	first := make([]int, len(lines))
	top := func(i int) int {
		for first[i] < len(scored[i]) && taken[scored[i][first[i]].TransactionID] {
			first[i]++
		}
		if first[i] == len(scored[i]) {
			return -1 << 31
		}
		return scored[i][first[i]].Score
	}
	done := make([]bool, len(lines))
	for range lines {
		next := -1
		for i := range lines {
			if !done[i] && (next == -1 || top(i) > top(next)) {
				next = i
			}
		}
		done[next] = true
		cands := slices.DeleteFunc(slices.Clone(scored[next]), func(c Scored) bool { return taken[c.TransactionID] })
		out[next] = decide(cands)
		if out[next].Zone == ZoneLink {
			taken[out[next].TransactionID] = true
		}
	}
	return out
}

// candidates scores each transaction once, best first, then nearest, then earliest given.
func candidates(l MatchLine, postings []LedgerPosting) []Scored {
	var out []Scored
	seen := map[uuid.UUID]bool{}
	for _, p := range postings {
		if seen[p.TransactionID] {
			continue
		}
		seen[p.TransactionID] = true
		if s, ok := Score(l, p); ok {
			out = append(out, s)
		}
	}
	slices.SortStableFunc(out, func(a, b Scored) int {
		return cmp.Or(cmp.Compare(b.Score, a.Score), cmp.Compare(a.days, b.days))
	})
	return out
}

func best(cands []Scored) int {
	if len(cands) == 0 {
		return -1 << 31
	}
	return cands[0].Score
}

func decide(cands []Scored) Assignment {
	if best(cands) < ReviewScore {
		return Assignment{Zone: ZoneNew}
	}
	rivals := 0
	for _, c := range cands[1:] {
		if cands[0].Score-c.Score < LinkMargin {
			rivals++
		}
	}
	switch {
	case cands[0].Score >= LinkScore && cands[0].Amount == AmountIdentical && rivals == 0:
		return Assignment{Zone: ZoneLink, TransactionID: cands[0].TransactionID, Candidates: cands[:1]}
	case cands[0].Score >= LinkScore && rivals > 0 && cands[1].Score >= LinkScore:
		return Assignment{Zone: ZoneAmbiguous, Candidates: reviewed(cands)}
	default:
		return Assignment{Zone: ZoneProbable, Candidates: reviewed(cands)}
	}
}

// reviewed keeps the candidates a review shows: those at or above the review threshold.
func reviewed(cands []Scored) []Scored {
	end := slices.IndexFunc(cands, func(c Scored) bool { return c.Score < ReviewScore })
	if end == -1 {
		return cands
	}
	return cands[:end]
}

// overlaps reports whether the word sets of two descriptions share at least half of their
// union (Jaccard index); words have three or more letters, compared without case or accents.
func overlaps(a, b string) bool {
	x, y := words(a), words(b)
	if len(x) == 0 || len(y) == 0 {
		return false
	}
	shared := 0
	for w := range x {
		if y[w] {
			shared++
		}
	}
	return shared*100 >= (len(x)+len(y)-shared)*overlapPercent
}

func words(s string) map[string]bool {
	out := map[string]bool{}
	for _, w := range strings.FieldsFunc(textfold.String(s), func(r rune) bool { return !unicode.IsLetter(r) }) {
		if len([]rune(w)) >= 3 {
			out[w] = true
		}
	}
	return out
}

func abs(n int64) int64 { return max(n, -n) }

// Feed is the span of an account's lines from an institution: from the mapping's start or the
// first imported period to the last synced date or the end of the last imported period; nil
// bounds when the account has none (A103).
type Feed struct {
	From, To *time.Time
}
