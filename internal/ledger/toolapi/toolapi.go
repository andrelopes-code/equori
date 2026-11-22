// Package toolapi declares the ledger's tools for language models (ADR 012).
package toolapi

import (
	"context"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func Tools(svc *app.Service, files ConversationFile) []tool.Tool {
	return []tool.Tool{
		tool.WithUndo(attachFile(svc, files), undoAttach),
		detachAttachment(svc),
		listAccounts(
			svc,
		),
		getBalances(svc),
		searchTransactions(svc),
		getTransaction(svc),
		listPayeesAndTags(svc),
		getAccountDetails(svc),
		getStatement(svc),
		tool.WithUndo(recordTransaction(svc), undoByVoid),
		tool.WithUndo(changeTransaction(svc), undoCorrect),
		tool.WithUndo(categorizeTransactions(svc), undoCategorize),
		restoreTransaction(svc),
		voidTransaction(svc),
		tool.WithUndo(manageCard(svc), undoCard),
		handleCardPurchase(svc),
		settleStatement(svc),
		tool.WithUndo(manageAccountsAndPayees(svc), undoOrganize),
		reconcileAccount(svc),
		tool.WithUndo(recordInvestment(svc), undoByVoid),
		tool.WithUndo(recordFixedIncome(svc), undoByVoid),
		tool.WithUndo(transferCustody(svc), undoByVoid),
		tool.WithUndo(recordCorporateAction(svc), undoByVoid),
		recordBrokerageNote(svc),
		setBaseCurrency(svc),
		getHoldingLots(svc),
		setCardFace(svc),
		estimateRedemption(svc),
	}
}

type accountClass string

func (accountClass) Values() []string {
	return []string{"asset", "liability", "equity", "income", "expense"}
}

// allAccounts reads every account of the book in the order of ListAccounts, by class and then name.
func allAccounts(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
) (map[uuid.UUID]domain.Account, []domain.Account, error) {
	var all []domain.Account

	p := page.Request[app.AccountKey]{Limit: page.MaxLimit}
	for {
		rows, next, err := svc.ListAccounts(ctx, booksID, p)
		if err != nil {
			return nil, nil, err
		}

		all = append(all, rows...)

		if next == nil {
			break
		}

		p.After = next
	}

	byID := make(map[uuid.UUID]domain.Account, len(all))
	for _, a := range all {
		byID[a.ID] = a
	}

	return byID, all, nil
}

// allPages reads every page of a listing at the largest page size.
func allPages[T, K any](list func(page.Request[K]) ([]T, *K, error)) ([]T, error) {
	var all []T

	p := page.Request[K]{Limit: page.MaxLimit}
	for {
		rows, next, err := list(p)
		if err != nil {
			return nil, err
		}

		all = append(all, rows...)
		if next == nil {
			return all, nil
		}

		p.After = next
	}
}

// minorMoney builds an amount in minor units of the instrument of unit.
func minorMoney(unit money.Money, amount int64) (tool.Money, error) {
	m, err := money.NewOf(amount, unit.Currency(), unit.Scale())
	return tool.MoneyOf(m), err
}

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

// percentBP reads a percent with at most two decimals, such as 25 or 12.5, as basis points.
func percentBP(s string) (int, bool) {
	whole, frac, _ := strings.Cut(s, ".")
	if len(frac) > 2 {
		return 0, false
	}

	n, err := strconv.Atoi(whole + (frac + "00")[:2])

	return n, err == nil && whole != ""
}
