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

type getAccountDetailsIn struct {
	AccountID      string    `json:"account_id" jsonschema:"ID of the account, from list_accounts"`
	PurchaseDate   tool.Date `json:"purchase_date,omitzero" jsonschema:"for a card: return the statement a purchase on this date is billed on"`
	Month          string    `json:"month,omitzero" jsonschema:"for a card: return the installments committed to the statement of this month; written YYYY-MM"`
	StatementsFrom string    `json:"statements_from,omitzero" jsonschema:"for a card: first statement month to list; the last 6 months when absent; written YYYY-MM"`
}

type accountSummaryView struct {
	AccountID string `json:"account_id"`
	Name      string `json:"name"`
	Class     string `json:"class"`
	Kind      string `json:"kind,omitzero"`
	Currency  string `json:"currency"`
	Closed    bool   `json:"closed,omitzero"`
}

type openDifferenceView struct {
	AssertionID string     `json:"assertion_id"`
	Date        tool.Date  `json:"date"`
	Difference  tool.Money `json:"difference"`
}

type reconciliationView struct {
	LastReconciledOn tool.Date          `json:"last_reconciled_on,omitzero"`
	OpenDifference   openDifferenceView `json:"open_difference,omitzero"`
}

type assertionView struct {
	Date       tool.Date  `json:"date"`
	Amount     tool.Money `json:"amount"`
	Reconciled bool       `json:"reconciled"`
	Source     string     `json:"source"`
}

type cardView struct {
	CardID   string `json:"card_id"`
	Holder   string `json:"holder"`
	LastFour string `json:"last_four"`
	Virtual  bool   `json:"virtual,omitzero"`
	Active   bool   `json:"active"`
}

type billingCycleView struct {
	ClosingDay    int    `json:"closing_day"`
	DueDay        int    `json:"due_day"`
	EffectiveFrom string `json:"effective_from" jsonschema:"YYYY-MM"`
}

type statementRowView struct {
	StatementID string     `json:"statement_id"`
	Reference   string     `json:"reference" jsonschema:"YYYY-MM"`
	ClosingDate tool.Date  `json:"closing_date"`
	DueDate     tool.Date  `json:"due_date"`
	Status      string     `json:"status"`
	AmountDue   tool.Money `json:"amount_due"`
	Unpaid      tool.Money `json:"unpaid"`
}

type placementView struct {
	Reference   string    `json:"reference" jsonschema:"YYYY-MM"`
	ClosingDate tool.Date `json:"closing_date"`
	DueDate     tool.Date `json:"due_date"`
}

type commitmentView struct {
	Month  string     `json:"month" jsonschema:"YYYY-MM"`
	Amount tool.Money `json:"amount"`
}

type cardDetailsView struct {
	Cards          []cardView         `json:"cards"`
	CreditLimit    tool.Money         `json:"credit_limit,omitzero"`
	AvailableLimit tool.Money         `json:"available_limit,omitzero"`
	BillingCycle   billingCycleView   `json:"billing_cycle,omitzero"`
	Statements     []statementRowView `json:"statements"`
	Placement      placementView      `json:"placement,omitzero"`
	Committed      commitmentView     `json:"committed,omitzero"`
}

type getAccountDetailsOut struct {
	Account           accountSummaryView `json:"account"`
	Reconciliation    reconciliationView `json:"reconciliation"`
	BalanceAssertions []assertionView    `json:"balance_assertions"`
	Card              cardDetailsView    `json:"card,omitzero"`
}

func getAccountDetails(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_account_details",
		Description: "Returns one account in depth: reconciliation state and recorded institution balances; " +
			"for a credit card account, its plastic cards, current credit limit and available limit, billing cycle, statements, " +
			"the statement a purchase date falls on and the installments already committed to a month. " +
			"Use it for questions about one account or card. " +
			"Do not use it for a statement's lines: get_statement returns them.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, userID int64, in getAccountDetailsIn) (getAccountDetailsOut, error) {
		id, err := requiredID(in.AccountID, "account_id")
		if err != nil {
			return getAccountDetailsOut{}, err
		}
		a, err := svc.Account(ctx, userID, id)
		if err != nil {
			return getAccountDetailsOut{}, err
		}
		isCard := a.Kind == domain.KindCreditCard
		if !isCard {
			switch {
			case in.Month != "":
				return getAccountDetailsOut{}, tool.InvalidArgument("month", "applies only to a credit card account")
			case !in.PurchaseDate.IsZero():
				return getAccountDetailsOut{}, tool.InvalidArgument("purchase_date", "applies only to a credit card account")
			case in.StatementsFrom != "":
				return getAccountDetailsOut{}, tool.InvalidArgument("statements_from", "applies only to a credit card account")
			}
		}
		var month, from *domain.ReferenceMonth
		if month, err = parseMonth(in.Month, "month"); err != nil {
			return getAccountDetailsOut{}, err
		}
		if from, err = parseMonth(in.StatementsFrom, "statements_from"); err != nil {
			return getAccountDetailsOut{}, err
		}

		out := getAccountDetailsOut{
			Account: accountSummaryView{
				AccountID: a.ID.String(), Name: a.Name, Class: string(a.Class), Kind: string(a.Kind),
				Currency: string(a.Instrument), Closed: a.ClosedOn != nil,
			},
			BalanceAssertions: []assertionView{},
		}
		unit, err := svc.AmountOf(ctx, 0, a.Instrument)
		if err != nil {
			return out, err
		}
		if out.Reconciliation, err = reconciliationOf(ctx, svc, userID, id); err != nil {
			return out, err
		}
		assertions, _, err := svc.BalanceAssertions(ctx, userID, id, page.Request[app.AssertionKey]{Limit: 5})
		if err != nil {
			return out, err
		}
		for _, b := range assertions {
			amount, err := minorMoney(unit, b.Amount)
			if err != nil {
				return out, err
			}
			out.BalanceAssertions = append(out.BalanceAssertions, assertionView{Date: tool.DateOf(b.Date), Amount: amount, Reconciled: b.Reconciled, Source: b.Source})
		}
		if isCard {
			out.Card, err = cardDetailsOf(ctx, svc, userID, a, unit, in, month, from)
		}
		return out, err
	})
}

func parseMonth(s, field string) (*domain.ReferenceMonth, error) {
	if s == "" {
		return nil, nil
	}
	m, err := domain.ParseReferenceMonth(s)
	if err != nil {
		return nil, tool.InvalidArgument(field, "must be written YYYY-MM")
	}
	return &m, nil
}

func reconciliationOf(ctx context.Context, svc *app.Service, userID int64, id uuid.UUID) (reconciliationView, error) {
	st, err := svc.ReconciliationStatus(ctx, userID, id)
	if err != nil {
		return reconciliationView{}, err
	}
	var out reconciliationView
	if st.LastReconciledOn != nil {
		out.LastReconciledOn = tool.DateOf(*st.LastReconciledOn)
	}
	if o := st.Open; o != nil {
		out.OpenDifference = openDifferenceView{AssertionID: o.AssertionID.String(), Date: tool.DateOf(o.Date), Difference: tool.MoneyOf(o.Difference)}
	}
	return out, nil
}

func cardDetailsOf(ctx context.Context, svc *app.Service, userID int64, a domain.Account, unit money.Money,
	in getAccountDetailsIn, month, from *domain.ReferenceMonth) (cardDetailsView, error) {
	today := svc.Today()
	out := cardDetailsView{Cards: []cardView{}, Statements: []statementRowView{}}
	cards, err := svc.Cards(ctx, userID, a.ID)
	if err != nil {
		return cardDetailsView{}, err
	}
	for _, c := range cards {
		out.Cards = append(out.Cards, cardView{CardID: c.ID.String(), Holder: c.Holder, LastFour: c.LastFour, Virtual: c.Virtual, Active: c.Active})
	}
	limits, err := svc.CreditLimits(ctx, userID, a.ID)
	if err != nil {
		return cardDetailsView{}, err
	}
	if len(limits) > 0 {
		sum, err := svc.CardSummary(ctx, userID, a)
		if err != nil {
			return cardDetailsView{}, err
		}
		if sum != nil {
			out.CreditLimit, out.AvailableLimit = tool.MoneyOf(sum.CreditLimit), tool.MoneyOf(sum.AvailableLimit)
		}
	}
	rules, err := svc.BillingRules(ctx, userID, a.ID)
	if err != nil {
		return cardDetailsView{}, err
	}
	if r, err := rules.For(domain.MonthOf(today)); err == nil {
		out.BillingCycle = billingCycleView{ClosingDay: r.ClosingDay, DueDay: r.DueDay, EffectiveFrom: r.EffectiveFrom.String()}
	}
	if from == nil {
		m := domain.MonthOf(today.AddDate(0, -6, 0))
		from = &m
	}
	views, err := allPages(func(p page.Request[app.StatementKey]) ([]app.StatementView, *app.StatementKey, error) {
		rows, next, _, err := svc.Statements(ctx, userID, a.ID, from, nil, p)
		return rows, next, err
	})
	if err != nil {
		return cardDetailsView{}, err
	}
	for _, v := range views {
		due, err := minorMoney(unit, v.Summary.AmountDue)
		if err != nil {
			return cardDetailsView{}, err
		}
		unpaid, err := minorMoney(unit, v.Summary.Unpaid)
		if err != nil {
			return cardDetailsView{}, err
		}
		out.Statements = append(out.Statements, statementRowView{
			StatementID: v.ID.String(), Reference: v.Input.Reference.String(), ClosingDate: tool.DateOf(v.Input.Closing),
			DueDate: tool.DateOf(v.Input.Due), Status: v.Summary.Status, AmountDue: due, Unpaid: unpaid,
		})
	}
	if !in.PurchaseDate.IsZero() {
		pl, err := svc.PlaceStatement(ctx, userID, a.ID, in.PurchaseDate.Time)
		if err != nil {
			return cardDetailsView{}, err
		}
		out.Placement = placementView{Reference: pl.Reference.String(), ClosingDate: tool.DateOf(pl.Closing), DueDate: tool.DateOf(pl.Due)}
	}
	if month != nil {
		m, err := svc.Commitment(ctx, userID, a.ID, *month)
		if err != nil {
			return cardDetailsView{}, err
		}
		out.Committed = commitmentView{Month: month.String(), Amount: tool.MoneyOf(m)}
	}
	return out, nil
}
