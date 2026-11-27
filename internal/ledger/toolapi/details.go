package toolapi

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func getAccountDetails(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_account_details",
		Description: "Returns one account in depth: reconciliation state and recorded institution balances; " +
			"for a credit card account, its plastic cards, current credit limit and available limit, billing cycle, statements, " +
			"the statement a purchase date falls on and the installments already committed to a month. " +
			"Use it for questions about one account or card. " +
			"Do not use it for a statement's lines: get_statement returns them.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, booksID int64, in getAccountDetailsIn) (getAccountDetailsOut, error) {
		return runGetAccountDetails(ctx, svc, booksID, in)
	})
}

func runGetAccountDetails(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in getAccountDetailsIn,
) (getAccountDetailsOut, error) {
	id, err := requiredID(in.AccountID, "account_id")
	if err != nil {
		return getAccountDetailsOut{}, err
	}

	a, err := svc.Account(ctx, booksID, id)
	if err != nil {
		return getAccountDetailsOut{}, err
	}

	isCard := a.Kind == domain.KindCreditCard
	if !isCard {
		if err = rejectCardArguments(in); err != nil {
			return getAccountDetailsOut{}, err
		}
	}

	var month, from *domain.ReferenceMonth
	if month, err = parseMonth(in.Month, "month"); err != nil {
		return getAccountDetailsOut{}, err
	}

	if from, err = parseMonth(in.StatementsFrom, "statements_from"); err != nil {
		return getAccountDetailsOut{}, err
	}

	out := getAccountDetailsOut{Account: accountSummaryOf(a), BalanceAssertions: []assertionView{}}

	unit, err := svc.AmountOf(ctx, 0, a.Instrument)
	if err != nil {
		return out, err
	}

	if out.Reconciliation, err = reconciliationOf(ctx, svc, booksID, id); err != nil {
		return out, err
	}

	if err = addAssertions(ctx, svc, booksID, id, unit, &out); err != nil {
		return out, err
	}

	if isCard {
		out.Card, err = cardDetailsOf(ctx, svc, booksID, a, unit, in, month, from)
	}

	return out, err
}

func accountSummaryOf(a domain.Account) accountSummaryView {
	return accountSummaryView{
		AccountID: a.ID.String(), Name: a.Name, Class: string(a.Class), Kind: string(a.Kind),
		Currency: string(a.Instrument), Closed: a.ClosedOn != nil,
	}
}

func rejectCardArguments(in getAccountDetailsIn) error {
	switch {
	case in.Month != "":
		return tool.InvalidArgument("month", "applies only to a credit card account")
	case !in.PurchaseDate.IsZero():
		return tool.InvalidArgument("purchase_date", "applies only to a credit card account")
	case in.StatementsFrom != "":
		return tool.InvalidArgument("statements_from", "applies only to a credit card account")
	}

	return nil
}

func addAssertions(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	id uuid.UUID,
	unit money.Money,
	out *getAccountDetailsOut,
) error {
	assertions, _, err := svc.BalanceAssertions(
		ctx,
		booksID,
		id,
		page.Request[app.AssertionKey]{Limit: 5},
	)
	if err != nil {
		return err
	}

	for _, b := range assertions {
		amount, err := minorMoney(unit, b.Amount)
		if err != nil {
			return err
		}

		out.BalanceAssertions = append(
			out.BalanceAssertions,
			assertionView{
				Date:       tool.DateOf(b.Date),
				Amount:     amount,
				Reconciled: b.Reconciled,
				Source:     b.Source,
			},
		)
	}

	return nil
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

func reconciliationOf(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	id uuid.UUID,
) (reconciliationView, error) {
	st, err := svc.ReconciliationStatus(ctx, booksID, id)
	if err != nil {
		return reconciliationView{}, err
	}

	var out reconciliationView
	if st.LastReconciledOn != nil {
		out.LastReconciledOn = tool.DateOf(*st.LastReconciledOn)
	}

	if o := st.Open; o != nil {
		out.OpenDifference = openDifferenceView{
			AssertionID: o.AssertionID.String(),
			Date:        tool.DateOf(o.Date),
			Difference:  tool.MoneyOf(o.Difference),
		}
	}

	return out, nil
}

func cardDetailsOf(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a domain.Account,
	unit money.Money,
	in getAccountDetailsIn,
	month, from *domain.ReferenceMonth,
) (cardDetailsView, error) {
	today := svc.Today(ctx)

	out, err := cardBaseOf(ctx, svc, booksID, a, today)
	if err != nil {
		return cardDetailsView{}, err
	}

	if from == nil {
		m := domain.MonthOf(today.AddDate(0, -6, 0))
		from = &m
	}

	if out.Statements, err = loadStatementRows(
		ctx,
		svc,
		booksID,
		a,
		unit,
		from,
		out.Statements,
	); err != nil {
		return cardDetailsView{}, err
	}

	if !in.PurchaseDate.IsZero() {
		pl, err := svc.PlaceStatement(ctx, booksID, a.ID, in.PurchaseDate.Time)
		if err != nil {
			return cardDetailsView{}, err
		}

		out.Placement = placementView{
			Reference:   pl.Reference.String(),
			ClosingDate: tool.DateOf(pl.Closing),
			DueDate:     tool.DateOf(pl.Due),
		}
	}

	if month != nil {
		m, err := svc.Commitment(ctx, booksID, a.ID, *month)
		if err != nil {
			return cardDetailsView{}, err
		}

		out.Committed = commitmentView{Month: month.String(), Amount: tool.MoneyOf(m)}
	}

	return out, nil
}

func cardBaseOf(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a domain.Account,
	today time.Time,
) (cardDetailsView, error) {
	out := cardDetailsView{Cards: []cardView{}, Statements: []statementRowView{}}

	var err error

	if out.Cards, err = loadCardViews(ctx, svc, booksID, a); err != nil {
		return cardDetailsView{}, err
	}

	if err := loadCreditLimit(ctx, svc, booksID, a, &out); err != nil {
		return cardDetailsView{}, err
	}

	rules, err := svc.BillingRules(ctx, booksID, a.ID)
	if err != nil {
		return cardDetailsView{}, err
	}

	out.BillingCycles = billingCyclesFrom(rules, domain.MonthOf(today))

	return out, nil
}

// billingCyclesFrom is the version in force in month m and every later version, oldest first.
func billingCyclesFrom(rules domain.Rules, m domain.ReferenceMonth) []billingCycleView {
	from := m
	if current, err := rules.For(m); err == nil {
		from = current.EffectiveFrom
	}

	sorted := slices.SortedFunc(slices.Values(rules), func(a, b domain.BillingCycleRule) int {
		return a.EffectiveFrom.Compare(b.EffectiveFrom)
	})

	out := []billingCycleView{}
	for _, r := range sorted {
		if r.EffectiveFrom.Compare(from) < 0 {
			continue
		}

		out = append(out, billingCycleView{
			EffectiveFrom:        r.EffectiveFrom.String(),
			ClosingMode:          r.ClosingMode,
			ClosingDay:           r.ClosingDay,
			ClosingDaysBeforeDue: r.ClosingDaysBeforeDue,
			ClosingAdjustment:    r.ClosingAdjustment,
			DueDay:               r.DueDay,
			DueDateAdjustment:    r.Adjustment,
			ClosingDayAssignment: r.Assignment,
			Calendar:             r.Calendar,
		})
	}

	return out
}

func loadCardViews(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a domain.Account,
) ([]cardView, error) {
	views := []cardView{}

	cards, err := svc.Cards(ctx, booksID, a.ID)
	if err != nil {
		return nil, err
	}

	for _, c := range cards {
		views = append(views, cardView{
			CardID:   c.ID.String(),
			Holder:   c.Holder,
			LastFour: c.LastFour,
			Virtual:  c.Virtual,
			Active:   c.Active,
		})
	}

	return views, nil
}

func loadCreditLimit(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a domain.Account,
	out *cardDetailsView,
) error {
	limits, err := svc.CreditLimits(ctx, booksID, a.ID)
	if err != nil {
		return err
	}

	if len(limits) == 0 {
		return nil
	}

	sum, err := svc.CardSummary(ctx, booksID, a)
	if err != nil {
		return err
	}

	if sum != nil {
		out.CreditLimit, out.AvailableLimit = tool.MoneyOf(
			sum.CreditLimit,
		), tool.MoneyOf(
			sum.AvailableLimit,
		)
	}

	return nil
}

func loadStatementRows(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	a domain.Account,
	unit money.Money,
	from *domain.ReferenceMonth,
	rows []statementRowView,
) ([]statementRowView, error) {
	views, err := allPages(
		func(p page.Request[app.StatementKey]) ([]app.StatementView, *app.StatementKey, error) {
			rows, next, _, err := svc.Statements(ctx, booksID, a.ID, from, nil, p)
			return rows, next, err
		},
	)
	if err != nil {
		return nil, err
	}

	for _, v := range views {
		due, err := minorMoney(unit, v.Summary.AmountDue)
		if err != nil {
			return nil, err
		}

		unpaid, err := minorMoney(unit, v.Summary.Unpaid)
		if err != nil {
			return nil, err
		}

		rows = append(rows, statementRowView{
			StatementID: v.ID.String(),
			Reference:   v.Input.Reference.String(),
			ClosingDate: tool.DateOf(v.Input.Closing),
			DueDate: tool.DateOf(
				v.Input.Due,
			),
			Status:    v.Summary.Status,
			AmountDue: due,
			Unpaid:    unpaid,
		})
	}

	return rows, nil
}
