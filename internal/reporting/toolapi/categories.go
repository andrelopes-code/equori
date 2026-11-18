package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/reporting/app"
)

type categoryClass string

func (categoryClass) Values() []string { return []string{"income", "expense"} }

type categoryTotalsView string

func (categoryTotalsView) Values() []string {
	return []string{string(app.ViewAccrual), string(app.ViewCash)}
}

type getCategoryTotalsIn struct {
	Class      categoryClass      `json:"class"                jsonschema:"expense totals spending, income totals earnings; both are positive"`
	From       tool.Date          `json:"from"                 jsonschema:"first date, inclusive"`
	To         tool.Date          `json:"to"                   jsonschema:"last date, inclusive; at most 366 days after from"`
	View       categoryTotalsView `json:"view,omitzero"        jsonschema:"accrual counts a card purchase on its date; cash counts it when its statement is paid, in proportion to the payment; accrual when absent"`
	CategoryID string             `json:"category_id,omitzero" jsonschema:"with view cash: also list the card amounts of this category, each with its statement and payment"`
	tool.PageArgs
}

type cashPaymentView struct {
	Date                 tool.Date  `json:"date"`
	Amount               tool.Money `json:"amount"`
	CardAccountID        string     `json:"card_account_id"`
	StatementID          string     `json:"statement_id"`
	StatementReference   tool.Date  `json:"statement_reference"    jsonschema:"first day of the statement month"`
	PaymentTransactionID string     `json:"payment_transaction_id"`
}

type categoryView struct {
	AccountID    string     `json:"account_id"`
	Name         string     `json:"name"`
	ParentID     string     `json:"parent_id,omitzero"`
	ParentName   string     `json:"parent_name,omitzero"`
	Total        tool.Money `json:"total"                jsonschema:"postings on the category itself"`
	SubtreeTotal tool.Money `json:"subtree_total"        jsonschema:"postings on the category and its descendants"`
}

type getCategoryTotalsOut struct {
	From       tool.Date         `json:"from"`
	To         tool.Date         `json:"to"`
	Categories []categoryView    `json:"categories"`
	Payments   []cashPaymentView `json:"payments,omitzero"    jsonschema:"with category_id: the card amounts of that category in the cash view"`
	NextCursor string            `json:"next_cursor,omitzero" jsonschema:"present when more categories follow; pass it as cursor"`
}

func getCategoryTotals(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_category_totals",
		Description: "Totals the income or expense categories in a period, each with its own total and the total of its subtree, " +
			"in category name order; only categories with postings and their ancestors are listed. " +
			"View cash counts card purchases when the statement is paid, as the Reports screen does. " +
			"Use it for how much was spent or earned by category. " +
			"Do not use it for the transactions behind a total: search_transactions with account_id lists them.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, booksID int64, in getCategoryTotalsIn) (getCategoryTotalsOut, error) {
		view := app.ViewAccrual
		if in.View != "" {
			view = app.View(in.View)
		}

		payments, err := cashPaymentViews(ctx, svc, booksID, in, view)
		if err != nil {
			return getCategoryTotalsOut{}, err
		}

		totals, err := svc.CategoryTotals(
			ctx,
			booksID,
			string(in.Class),
			in.From.Time,
			in.To.Time,
			view,
		)
		if err != nil {
			return getCategoryTotalsOut{}, err
		}

		views, err := categoryViews(totals)
		if err != nil {
			return getCategoryTotalsOut{}, err
		}

		out := getCategoryTotalsOut{From: in.From, To: in.To, Payments: payments}
		out.Categories, out.NextCursor, err = tool.PageOf(
			views,
			func(v categoryView) string { return v.AccountID },
			in.PageArgs,
		)

		return out, err
	})
}

func categoryViews(totals []app.CategoryTotal) ([]categoryView, error) {
	names := make(map[uuid.UUID]string, len(totals))
	for _, t := range totals {
		names[t.AccountID] = t.Name
	}

	views := []categoryView{}
	for _, t := range active(totals) {
		total, err := money.New(t.Total, money.Currency(t.Instrument))
		if err != nil {
			return nil, err
		}

		subtree, err := money.New(t.SubtreeTotal, money.Currency(t.Instrument))
		if err != nil {
			return nil, err
		}

		v := categoryView{
			AccountID:    t.AccountID.String(),
			Name:         t.Name,
			Total:        tool.MoneyOf(total),
			SubtreeTotal: tool.MoneyOf(subtree),
		}
		if t.ParentID != uuid.Nil {
			v.ParentID, v.ParentName = t.ParentID.String(), names[t.ParentID]
		}

		views = append(views, v)
	}

	return views, nil
}

// active keeps the categories with postings of their own and their ancestors, in order. A
// subtree total is not enough: a refund on one child can cancel a purchase on another.
func active(totals []app.CategoryTotal) []app.CategoryTotal {
	parent := make(map[uuid.UUID]uuid.UUID, len(totals))
	for _, t := range totals {
		parent[t.AccountID] = t.ParentID
	}

	keep := map[uuid.UUID]bool{}
	for _, t := range totals {
		if t.Total == 0 {
			continue
		}

		for id := t.AccountID; id != uuid.Nil && !keep[id]; id = parent[id] {
			keep[id] = true
		}
	}

	var out []app.CategoryTotal
	for _, t := range totals {
		if keep[t.AccountID] {
			out = append(out, t)
		}
	}

	return out
}

// cashPaymentViews lists the card amounts of in.CategoryID in the cash view; nil without one.
func cashPaymentViews(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in getCategoryTotalsIn,
	view app.View,
) ([]cashPaymentView, error) {
	if in.CategoryID == "" {
		return nil, nil
	}

	if view != app.ViewCash {
		return nil, tool.InvalidArgument("category_id", "is used only with view cash")
	}

	id, err := uuid.Parse(in.CategoryID)
	if err != nil {
		return nil, tool.InvalidArgument("category_id", "is not a UUID")
	}

	payments, currency, err := svc.CategoryCashPayments(ctx, booksID, id, in.From.Time, in.To.Time)
	if err != nil {
		return nil, err
	}

	views := make([]cashPaymentView, len(payments))
	for i, p := range payments {
		amount, err := money.New(p.Amount, money.Currency(currency))
		if err != nil {
			return nil, err
		}

		views[i] = cashPaymentView{
			Date:                 tool.DateOf(p.Date),
			Amount:               tool.MoneyOf(amount),
			CardAccountID:        p.CardID.String(),
			StatementID:          p.StatementID.String(),
			StatementReference:   tool.DateOf(p.StatementReference),
			PaymentTransactionID: p.PaymentTransactionID.String(),
		}
	}

	return views, nil
}
