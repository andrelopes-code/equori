package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type searchTransactionsIn struct {
	Query         string    `json:"query,omitzero" jsonschema:"case-insensitive text found in the description, the payee name or a posting memo"`
	AccountID     string    `json:"account_id,omitzero" jsonschema:"keep transactions with a posting on this account or category; IDs come from list_accounts"`
	Tag           string    `json:"tag,omitzero" jsonschema:"keep transactions with this tag"`
	From          tool.Date `json:"from,omitzero" jsonschema:"first date, inclusive"`
	To            tool.Date `json:"to,omitzero" jsonschema:"last date, inclusive"`
	Uncategorized bool      `json:"uncategorized,omitzero" jsonschema:"keep only transactions still waiting for a category"`
	tool.PageArgs
}

type postingView struct {
	AccountID    string     `json:"account_id"`
	AccountName  string     `json:"account_name"`
	AccountClass string     `json:"account_class" jsonschema:"a posting on an income or expense account is the category of the transaction"`
	Amount       tool.Money `json:"amount"`
	Memo         string     `json:"memo,omitzero"`
}

type transactionView struct {
	ID          string        `json:"id"`
	Date        tool.Date     `json:"date"`
	Description string        `json:"description"`
	PayeeName   string        `json:"payee_name,omitzero"`
	Voided      bool          `json:"voided,omitzero"`
	Tags        []string      `json:"tags,omitzero"`
	Postings    []postingView `json:"postings"`
}

type searchTransactionsOut struct {
	Transactions []transactionView `json:"transactions"`
	NextCursor   string            `json:"next_cursor,omitzero" jsonschema:"present when more transactions follow; pass it as cursor"`
}

func searchTransactions(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "search_transactions",
		Description: "Searches the user's transactions, newest first, with their payee, tags and postings; " +
			"each posting names its account or category. " +
			"Use it to find transactions by text, account, category, tag, period or missing category, " +
			"and to get the transaction_id other tools take. " +
			"Do not use it for totals by category: get_category_totals adds them up. " +
			"Filters combine; narrow them instead of reading many pages.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, userID int64, in searchTransactionsIn) (searchTransactionsOut, error) {
		q, err := transactionQuery(userID, in)
		if err != nil {
			return searchTransactionsOut{}, err
		}
		rows, next, err := svc.ListTransactions(ctx, q)
		if err != nil {
			return searchTransactionsOut{}, err
		}
		accounts, _, err := allAccounts(ctx, svc, userID)
		if err != nil {
			return searchTransactionsOut{}, err
		}
		var payeeIDs []uuid.UUID
		for _, t := range rows {
			if t.PayeeID != uuid.Nil {
				payeeIDs = append(payeeIDs, t.PayeeID)
			}
		}
		payees, err := svc.PayeeNames(ctx, userID, payeeIDs)
		if err != nil {
			return searchTransactionsOut{}, err
		}
		out := searchTransactionsOut{Transactions: make([]transactionView, len(rows))}
		for i, t := range rows {
			out.Transactions[i] = viewOf(t, accounts, payees)
		}
		if next != nil {
			if out.NextCursor, err = page.EncodeCursor(next); err != nil {
				return searchTransactionsOut{}, err
			}
		}
		return out, nil
	})
}

func viewOf(t domain.Transaction, accounts map[uuid.UUID]domain.Account, payees map[uuid.UUID]string) transactionView {
	v := transactionView{
		ID: t.ID.String(), Date: tool.DateOf(t.Date), Description: t.Description, PayeeName: payees[t.PayeeID],
		Voided: t.VoidedAt != nil, Postings: make([]postingView, len(t.Postings)),
	}
	if len(t.Tags) > 0 {
		v.Tags = t.Tags
	}
	for j, p := range t.Postings {
		a := accounts[p.AccountID]
		v.Postings[j] = postingView{
			AccountID: p.AccountID.String(), AccountName: a.Name, AccountClass: string(a.Class),
			Amount: tool.MoneyOf(p.Amount), Memo: p.Memo,
		}
	}
	return v
}

// transactionQuery checks the argument values the schema cannot: identifiers, limit and cursor.
func transactionQuery(userID int64, in searchTransactionsIn) (app.TransactionQuery, error) {
	q := app.TransactionQuery{UserID: userID, Tag: in.Tag, Q: in.Query, Uncategorized: in.Uncategorized}
	var err error
	if q.AccountID, err = optionalID(in.AccountID, "account_id"); err != nil {
		return q, err
	}
	if q.Limit, err = tool.Limit(in.Limit); err != nil {
		return q, err
	}
	if in.Cursor != "" {
		var after app.TransactionCursor
		if err := page.DecodeCursor(in.Cursor, &after); err != nil {
			return q, tool.InvalidArgument("cursor", "is not a next_cursor of search_transactions")
		}
		q.After = &after
	}
	if !in.From.IsZero() {
		q.From = &in.From.Time
	}
	if !in.To.IsZero() {
		q.To = &in.To.Time
	}
	return q, nil
}

func optionalID(s, field string) (uuid.UUID, error) {
	if s == "" {
		return uuid.Nil, nil
	}
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, tool.InvalidArgument(field, "is not a UUID")
	}
	return id, nil
}
