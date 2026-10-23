// Package toolapi declares the ledger's tools for language models (ADR 012).
package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func Tools(svc *app.Service) []tool.Tool {
	return []tool.Tool{
		listAccounts(svc), getBalances(svc), searchTransactions(svc), getTransaction(svc), listPayeesAndTags(svc),
		getAccountDetails(svc), getStatement(svc),
	}
}

type accountClass string

func (accountClass) Values() []string {
	return []string{"asset", "liability", "equity", "income", "expense"}
}

// allAccounts reads every account of the user in the order of ListAccounts, by class and then name.
func allAccounts(ctx context.Context, svc *app.Service, userID int64) (map[uuid.UUID]domain.Account, []domain.Account, error) {
	var all []domain.Account
	p := page.Request[app.AccountKey]{Limit: page.MaxLimit}
	for {
		rows, next, err := svc.ListAccounts(ctx, userID, p)
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
