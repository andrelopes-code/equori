package toolapi

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/reporting/app"
)

type getStatementAnalyticsIn struct {
	StatementID string `json:"statement_id,omitzero" jsonschema:"one statement, from get_account_details; the answer splits it per category"`
	AccountID   string `json:"account_id,omitzero"   jsonschema:"credit card account, from list_accounts; instead of statement_id: its 12 latest closed statements, oldest first, without categories"`
}

type statementPartsView struct {
	Purchases    tool.Money `json:"purchases"    jsonschema:"purchases billed in one payment"`
	Installments tool.Money `json:"installments" jsonschema:"installments of purchases split in payments"`
	Charges      tool.Money `json:"charges"      jsonschema:"interest and fees"`
	Credits      tool.Money `json:"credits"      jsonschema:"refunds and other credits, negative"`
	Total        tool.Money `json:"total"`
}

type statementCategoryView struct {
	CategoryID   string `json:"category_id"`
	CategoryName string `json:"category_name"`
	statementPartsView
}

type statementAnalyticsView struct {
	StatementID string `json:"statement_id"`
	Reference   string `json:"reference"           jsonschema:"statement month, YYYY-MM"`
	statementPartsView
	Categories []statementCategoryView `json:"categories,omitzero"`
}

type getStatementAnalyticsOut struct {
	Statements []statementAnalyticsView `json:"statements"`
}

func getStatementAnalytics(svc *app.Service, clk app.Clock) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_statement_analytics",
		Description: "Splits what a credit card statement bills into purchases, installments, charges and credits, in total and per category; " +
			"with account_id it returns that split for the 12 latest closed statements of the card. " +
			"Use it to explain what makes up a statement or how the card's spending changed over the months. " +
			"Do not use it for the lines of a statement: get_statement lists them.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, booksID int64, in getStatementAnalyticsIn) (getStatementAnalyticsOut, error) {
		if (in.StatementID == "") == (in.AccountID == "") {
			field := "statement_id"
			if in.StatementID != "" {
				field = "account_id"
			}

			return getStatementAnalyticsOut{}, tool.InvalidArgument(
				field,
				"name statement_id or account_id, not both",
			)
		}

		if in.AccountID != "" {
			return cardAnalytics(ctx, svc, clk, booksID, in.AccountID)
		}

		return oneStatementAnalytics(ctx, svc, booksID, in.StatementID)
	})
}

func oneStatementAnalytics(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	statementID string,
) (getStatementAnalyticsOut, error) {
	id, err := uuid.Parse(statementID)
	if err != nil {
		return getStatementAnalyticsOut{}, tool.InvalidArgument("statement_id", "is not a UUID")
	}

	a, err := svc.StatementAnalytics(ctx, booksID, id)
	if err != nil {
		return getStatementAnalyticsOut{}, err
	}

	view, err := toStatementAnalyticsView(a)
	if err != nil {
		return getStatementAnalyticsOut{}, err
	}

	view.Categories = make([]statementCategoryView, len(a.Categories))
	for i, c := range a.Categories {
		name, err := svc.AccountName(ctx, booksID, c.CategoryID)
		if err != nil {
			return getStatementAnalyticsOut{}, err
		}

		parts, err := toStatementPartsView(c.StatementParts, a.Instrument)
		if err != nil {
			return getStatementAnalyticsOut{}, err
		}

		view.Categories[i] = statementCategoryView{
			CategoryID:         c.CategoryID.String(),
			CategoryName:       name,
			statementPartsView: parts,
		}
	}

	return getStatementAnalyticsOut{Statements: []statementAnalyticsView{view}}, nil
}

func cardAnalytics(
	ctx context.Context,
	svc *app.Service,
	clk app.Clock,
	booksID int64,
	accountID string,
) (getStatementAnalyticsOut, error) {
	id, err := uuid.Parse(accountID)
	if err != nil {
		return getStatementAnalyticsOut{}, tool.InvalidArgument("account_id", "is not a UUID")
	}

	now := clk.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	statements, err := svc.CardStatementAnalytics(ctx, booksID, id, today)
	if err != nil {
		return getStatementAnalyticsOut{}, err
	}

	out := getStatementAnalyticsOut{Statements: make([]statementAnalyticsView, len(statements))}
	for i, a := range statements {
		if out.Statements[i], err = toStatementAnalyticsView(a); err != nil {
			return getStatementAnalyticsOut{}, err
		}
	}

	return out, nil
}

func toStatementAnalyticsView(a app.StatementAnalytics) (statementAnalyticsView, error) {
	parts, err := toStatementPartsView(a.StatementParts, a.Instrument)

	return statementAnalyticsView{
		StatementID:        a.Statement.ID.String(),
		Reference:          a.Statement.Reference.Format("2006-01"),
		statementPartsView: parts,
	}, err
}

func toStatementPartsView(p app.StatementParts, instrument string) (statementPartsView, error) {
	var v statementPartsView

	for _, f := range []struct {
		amount int64
		into   *tool.Money
	}{
		{p.Purchases, &v.Purchases}, {p.Installments, &v.Installments}, {p.Charges, &v.Charges},
		{p.Credits, &v.Credits}, {p.Total(), &v.Total},
	} {
		m, err := money.New(f.amount, money.Currency(instrument))
		if err != nil {
			return v, err
		}

		*f.into = tool.MoneyOf(m)
	}

	return v, nil
}
