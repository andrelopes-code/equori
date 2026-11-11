package domain

import (
	"slices"
)

var (
	transferWords = []string{"transferi", "transferir", "transferencia", "transf", "transfer"}
	incomeWords   = []string{"recebi", "recebido", "ganhei", "received", "income"}
	expenseWords  = []string{"gastei", "paguei", "comprei", "spent", "paid", "bought"}
	connectors    = []string{"de", "do", "da", "dos", "das", "no", "na", "nos", "nas", "em", "com", "para", "pra", "pro", "por"}
)

// keywords marks the kind words and reports the transfer and income words found.
func (r *lineReader) keywords() (transfer, income bool) {
	for i, w := range r.words {
		if !w.free() {
			continue
		}

		switch {
		case slices.Contains(transferWords, w.norm):
			transfer = true
		case slices.Contains(incomeWords, w.norm):
			income = true
		case slices.Contains(expenseWords, w.norm):
		default:
			continue
		}

		r.mark(i, i+1, RoleKind)
	}

	return transfer, income
}

func (r *lineReader) methods() []method {
	var named []method
	for i, w := range r.words {
		if m, ok := r.vocabulary.Lexicon.Methods[w.norm]; ok && w.free() {
			named = append(named, m)

			r.mark(i, i+1, RoleAccount)
		}
	}

	return named
}
