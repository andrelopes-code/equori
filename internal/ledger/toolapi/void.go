package toolapi

import (
	"context"
	"strconv"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type voidTransactionIn struct {
	TransactionID string `json:"transaction_id" jsonschema:"ID of the transaction, from search_transactions"`
	Reason        string `json:"reason"         jsonschema:"why the transaction is voided, kept in its history"`
}

type voidTransactionOut struct {
	TransactionID string `json:"transaction_id"`
	Voided        bool   `json:"voided"`
}

func basisOf(t domain.Transaction) string { return "v" + strconv.Itoa(t.Version) }

func voidTransaction(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "void_transaction",
		Description: "Proposes voiding a transaction: it stops counting in balances and reports and stays in history with the reason. " +
			"Use it when the user asks to delete, remove, cancel or void a transaction. " +
			"Do not use it to change values: change_transaction does. " +
			"The user confirms before the transaction is voided.",
		Effect: tool.Destructive,
	}, func(ctx context.Context, booksID int64, in voidTransactionIn) (tool.Preview, error) {
		t, err := voidTarget(ctx, svc, booksID, in)
		if err != nil {
			return tool.Preview{}, err
		}

		accounts, _, err := allAccounts(ctx, svc, booksID)
		if err != nil {
			return tool.Preview{}, err
		}

		return tool.Preview{
			Action:      "void_transaction",
			Target:      t.Description,
			Destructive: true,
			Basis:       basisOf(t),
			Changes:     []tool.Change{{Field: "reason", After: tool.TextValue(in.Reason)}},
			Items:       []tool.Item{itemOf(t, accounts)},
		}, nil
	}, func(ctx context.Context, booksID int64, in voidTransactionIn) (voidTransactionOut, error) {
		t, err := voidTarget(ctx, svc, booksID, in)
		if err != nil {
			return voidTransactionOut{}, err
		}

		if err := svc.VoidTransaction(ctx, booksID, t.ID, in.Reason); err != nil {
			return voidTransactionOut{}, err
		}

		return voidTransactionOut{TransactionID: t.ID.String(), Voided: true}, nil
	})
}

func voidTarget(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in voidTransactionIn,
) (domain.Transaction, error) {
	id, err := requiredID(in.TransactionID, "transaction_id")
	if err != nil {
		return domain.Transaction{}, err
	}

	if in.Reason == "" {
		return domain.Transaction{}, tool.InvalidArgument("reason", "is required")
	}

	return svc.Transaction(ctx, booksID, id)
}

// recorded reads the transaction a write recorded, and the one it corrects when given.
type recorded struct {
	TransactionID string `json:"transaction_id"`
}

// undoByVoid is the inverse of a write that records one transaction: voiding it. A call that
// corrects an existing transaction, or records none, has no inverse (answer views design V19).
func undoByVoid(in, out recorded, reason string) (string, any, bool) {
	void := voidTransactionIn{TransactionID: out.TransactionID, Reason: reason}
	return "void_transaction", void, in.TransactionID == "" && out.TransactionID != ""
}
