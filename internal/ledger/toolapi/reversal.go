package toolapi

import (
	"context"
	"errors"
	"slices"
	"strconv"
	"strings"

	"github.com/google/uuid"

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

// maxRestoreItems is the most transactions one restore takes (undo restore design, U1).
const maxRestoreItems = 50

type restoreItem struct {
	TransactionID string `json:"transaction_id" jsonschema:"from search_transactions"`
	Version       int    `json:"version"        jsonschema:"version to return to"`
}

type restoreTransactionIn struct {
	Items  []restoreItem `json:"items"  jsonschema:"at most 50"`
	Reason string        `json:"reason" jsonschema:"kept in the history"`
}

type restoreResult struct {
	TransactionID string `json:"transaction_id"`
	Status        string `json:"status"         jsonschema:"restored, not_found, version_unknown, version_conflict, transaction_voided or not_restorable"`
}

type restoreTransactionOut struct {
	Results []restoreResult `json:"results"`
}

func restoreTransaction(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "restore_transaction",
		Description: "Proposes returning transactions to an earlier version of their history. " +
			"Use it to undo a change of a transaction; get_transaction lists the versions. " +
			"Do not use it on a voided transaction. The user confirms first.",
		Effect:   tool.Write,
		Internal: true,
	}, func(ctx context.Context, booksID int64, in restoreTransactionIn) (tool.Preview, error) {
		return previewRestore(ctx, svc, booksID, in)
	}, func(ctx context.Context, booksID int64, in restoreTransactionIn) (restoreTransactionOut, error) {
		return runRestore(ctx, svc, booksID, in)
	})
}

func previewRestore(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in restoreTransactionIn,
) (tool.Preview, error) {
	ids, err := restoreIDs(in)
	if err != nil {
		return tool.Preview{}, err
	}

	accounts, _, err := allAccounts(ctx, svc, booksID)
	if err != nil {
		return tool.Preview{}, err
	}

	pv := tool.Preview{
		Action:  "restore_transaction",
		Changes: []tool.Change{{Field: "reason", After: tool.TextValue(in.Reason)}},
	}
	keys := make([]string, len(ids))

	for i, id := range ids {
		t, err := svc.Transaction(ctx, booksID, id)
		if err != nil {
			return tool.Preview{}, err
		}

		keys[i] = id.String() + ":" + strconv.Itoa(t.Version)
		pv.Items = append(pv.Items, itemOf(t, accounts))
	}

	slices.Sort(keys)
	pv.Basis = strings.Join(keys, ",")

	return pv, nil
}

func runRestore(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in restoreTransactionIn,
) (restoreTransactionOut, error) {
	ids, err := restoreIDs(in)
	if err != nil {
		return restoreTransactionOut{}, err
	}

	out := restoreTransactionOut{Results: make([]restoreResult, len(ids))}
	for i, id := range ids {
		status, err := restoreOne(ctx, svc, booksID, id, in.Items[i].Version, in.Reason)
		if err != nil {
			return out, err
		}

		out.Results[i] = restoreResult{TransactionID: id.String(), Status: status}
	}

	return out, nil
}

// restoreIDs checks the arguments the schema cannot and returns the ID of each item.
func restoreIDs(in restoreTransactionIn) ([]uuid.UUID, error) {
	if n := len(in.Items); n < 1 || n > maxRestoreItems {
		return nil, tool.InvalidArgument("items", "must have between 1 and 50 items")
	}

	if in.Reason == "" {
		return nil, tool.InvalidArgument("reason", "is required")
	}

	ids := make([]uuid.UUID, len(in.Items))
	for i, it := range in.Items {
		id, err := requiredID(it.TransactionID, "items")
		if err != nil {
			return nil, err
		}

		if slices.Contains(ids[:i], id) {
			return nil, tool.InvalidArgument("items", "repeats a transaction")
		}

		ids[i] = id
	}

	return ids, nil
}

// restoreOne stores the state the transaction held at version as its next version (U2). The
// error is a failure of the store; a refusal of the ledger is the status.
func restoreOne(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	id uuid.UUID,
	version int,
	reason string,
) (string, error) {
	t, err := svc.Transaction(ctx, booksID, id)
	if err != nil {
		return restoreStatus(err)
	}

	versions, err := svc.Versions(ctx, booksID, id)
	if err != nil {
		return restoreStatus(err)
	}

	at := slices.IndexFunc(versions, func(v app.Version) bool { return v.Version == version })
	if at < 0 {
		return "version_unknown", nil
	}

	_, err = svc.CorrectTransaction(ctx, booksID, id, t.Version, versions[at].Transaction, reason)

	return restoreStatus(err)
}

func restoreStatus(err error) (string, error) {
	switch {
	case err == nil:
		return "restored", nil
	case errors.Is(err, app.ErrNotFound):
		return "not_found", nil
	case errors.Is(err, domain.ErrVersionConflict):
		return "version_conflict", nil
	case errors.Is(err, domain.ErrVoided):
		return "transaction_voided", nil
	case errors.Is(err, domain.ErrValidation):
		return "not_restorable", nil
	}

	return "", err
}

// undoCategorize is the inverse of a categorization: each transaction it categorized returns
// to the version it held before (U4).
func undoCategorize(
	_ categorizeTransactionsIn,
	out categorizeTransactionsOut,
	reason string,
) (string, any, bool) {
	restore := restoreTransactionIn{Reason: reason}
	for _, r := range out.Results {
		if r.Status == "categorized" && r.Version > 0 {
			restore.Items = append(
				restore.Items,
				restoreItem{TransactionID: r.TransactionID, Version: r.Version},
			)
		}
	}

	return "restore_transaction", restore, len(restore.Items) > 0
}

// undoCorrect is the inverse of a correction: the version before the one it wrote (U5). A
// transfer and a reimbursement change a second transaction and have no inverse.
func undoCorrect(
	in changeTransactionIn,
	out changeTransactionOut,
	reason string,
) (string, any, bool) {
	restore := restoreTransactionIn{
		Items:  []restoreItem{{TransactionID: out.TransactionID, Version: out.Version - 1}},
		Reason: reason,
	}

	return "restore_transaction", restore, in.Action == "correct" && out.Version > 1
}
