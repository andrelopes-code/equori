package domain

import (
	"slices"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Account is a balance account a line may name (A111).
type Account struct {
	ID       uuid.UUID
	Class    string
	Kind     string
	Currency money.Currency
	// Handles are the names that mention the account: its name, its institution's name and
	// "final NNNN" and "*NNNN" of its active cards.
	Handles []string
}

// Vocabulary is what a reading resolves names against.
type Vocabulary struct {
	Accounts []Account
	// Base is the currency of a line without an account.
	Base money.Currency
}

func (v Vocabulary) account(id uuid.UUID) (Account, bool) {
	i := slices.IndexFunc(v.Accounts, func(a Account) bool { return a.ID == id })
	if i < 0 {
		return Account{}, false
	}
	return v.Accounts[i], true
}

// handleIndex maps a normalized handle to the indexes of the accounts that carry it.
type handleIndex struct {
	accounts map[string][]int
	maxWords int
}

func indexHandles(accounts []Account) handleIndex {
	idx := handleIndex{accounts: map[string][]int{}}
	for i, a := range accounts {
		for _, h := range a.Handles {
			key := Normalize(h)
			if key == "" || slices.Contains(idx.accounts[key], i) {
				continue
			}
			idx.accounts[key] = append(idx.accounts[key], i)
			idx.maxWords = max(idx.maxWords, len(strings.Fields(key)))
		}
	}
	return idx
}

var (
	destinationWords = []string{"para", "pra", "pro", "p/", "->", "→", "to"}
	sourceWords      = []string{"de", "do", "da", "from"}
)

// mention is a handle found in a line, with the direction word before it.
type mention struct {
	accounts            []int
	destination, source bool
}

// findMentions marks the longest handle at each position, left to right.
func (r *lineReader) findMentions(idx handleIndex) []mention {
	var out []mention
	ws := r.words
	for i := 0; i < len(ws); {
		length := 0
		for n := min(idx.maxWords, len(ws)-i); n >= 1; n-- {
			if accounts, ok := idx.accounts[r.key(i, n)]; ok {
				m := mention{accounts: accounts}
				first := i
				if i > 0 && ws[i-1].free() {
					switch {
					case slices.Contains(destinationWords, ws[i-1].norm):
						m.destination, first = true, i-1
					case slices.Contains(sourceWords, ws[i-1].norm):
						m.source, first = true, i-1
					}
				}
				r.mark(first, i+n, RoleAccount)
				out = append(out, m)
				length = n
				break
			}
		}
		i += max(length, 1)
	}
	return out
}

// key joins the normalized words i to i+n, or returns "" when one of them is taken.
func (r *lineReader) key(i, n int) string {
	parts := make([]string, n)
	for k := range n {
		w := r.words[i+k]
		if !w.free() || w.norm == "" {
			return ""
		}
		parts[k] = w.norm
	}
	return strings.Join(parts, " ")
}

// method is a group of method words (A111).
type method string

const (
	methodCredit method = "credit"
	methodDebit  method = "debit"
	methodCash   method = "cash"
	// methodCard is "cartão": credit, unless another method word names the group.
	methodCard method = "card"
)

var methodWords = map[string]method{
	"credito": methodCredit, "credit": methodCredit,
	"debito": methodDebit, "debit": methodDebit, "pix": methodDebit, "ted": methodDebit,
	"dinheiro": methodCash, "especie": methodCash, "cash": methodCash,
	"cartao": methodCard, "card": methodCard,
}

func (m method) admits(a Account) bool {
	switch m {
	case methodCredit, methodCard:
		return a.Kind == "credit_card"
	case methodDebit:
		return a.Class == "asset" && slices.Contains([]string{"checking", "savings", "wallet"}, a.Kind)
	case methodCash:
		return a.Kind == "cash"
	}
	return true
}

// methodOf returns the group the named methods select; conflict is true when the line
// names two groups other than card.
func methodOf(named []method) (m method, conflict bool) {
	groups := slices.Clone(named)
	slices.Sort(groups)
	groups = slices.Compact(groups)
	if len(groups) > 1 {
		groups = slices.DeleteFunc(groups, func(x method) bool { return x == methodCard })
	}
	switch len(groups) {
	case 0:
		return "", false
	case 1:
		return groups[0], false
	}
	return "", true
}
