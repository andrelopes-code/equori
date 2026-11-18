package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type setBaseCurrencyIn struct {
	BaseCurrency string `json:"base_currency" jsonschema:"ISO 4217 code of the currency the book adds its totals in, such as BRL or USD"`
}

type setBaseCurrencyOut struct {
	BaseCurrency string `json:"base_currency"`
}

func setBaseCurrency(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "set_base_currency",
		Description: "Proposes the base currency of the book, the currency of its totals, reports and budgets. " +
			"It is allowed only while the book has no transaction: after the first one it is refused (settings_locked) and nothing changes it. " +
			"Use it when the owner sets up a book in another currency; list_accounts shows the current one. " +
			"Do not use it for the currency of one account: manage_accounts_and_payees does. " +
			"The user confirms first.",
		Effect: tool.Write,
		Role:   auth.RoleOwner,
	}, func(ctx context.Context, booksID int64, in setBaseCurrencyIn) (tool.Preview, error) {
		settings, err := svc.Settings(ctx, booksID)
		if err != nil {
			return tool.Preview{}, err
		}

		return tool.Preview{
			Action: "set_base_currency",
			Changes: []tool.Change{{
				Field:  "currency",
				Before: tool.TextValue(string(settings.BaseCurrency)),
				After:  tool.TextValue(in.BaseCurrency),
			}},
		}, nil
	}, func(ctx context.Context, booksID int64, in setBaseCurrencyIn) (setBaseCurrencyOut, error) {
		err := svc.SetBaseCurrency(ctx, booksID, money.Currency(in.BaseCurrency))

		return setBaseCurrencyOut(in), err
	})
}
