package toolapi

import (
	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// itemOf describes t by its first non-category posting and its first named category.
func itemOf(t domain.Transaction, accounts map[uuid.UUID]domain.Account) tool.Item {
	it := tool.Item{Description: t.Description, Date: tool.DateValue(t.Date).Date}

	for _, p := range t.Postings {
		a := accounts[p.AccountID]

		switch {
		case !a.IsCategory() && it.Account == "":
			it.Account, it.Amount = a.Name, tool.MoneyValue(p.Amount)
		case a.IsCategory() && it.Category == "" && !isUncategorizedRole(a):
			it.Category = a.Name
		}
	}

	return it
}

func isUncategorizedRole(a domain.Account) bool {
	return a.SystemRole == domain.RoleUncategorizedExpense ||
		a.SystemRole == domain.RoleUncategorizedIncome
}
