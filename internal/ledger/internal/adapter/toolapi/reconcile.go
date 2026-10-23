package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type reconcileAccountAction string

func (reconcileAccountAction) Values() []string {
	return []string{"record_balance", "resolve_difference", "unlock"}
}

type reconcileAccountResolution string

func (reconcileAccountResolution) Values() []string {
	return []string{"adjustment", "yield", "transactions_added"}
}

type reconcileAccountIn struct {
	AccountID  string                     `json:"account_id" jsonschema:"account from list_accounts"`
	Action     reconcileAccountAction     `json:"action" jsonschema:"operation to propose"`
	Date       tool.Date                  `json:"date,omitzero" jsonschema:"for record_balance: date of the reported balance; for unlock: first date unlocked"`
	Amount     string                     `json:"amount,omitzero" jsonschema:"for record_balance: decimal balance the institution reports, negative for a debt"`
	Resolution reconcileAccountResolution `json:"resolution,omitzero" jsonschema:"for resolve_difference: adjustment posts the difference to Adjustments, yield to Yield; transactions_added checks again after the user recorded the missing transactions"`
}

type reconcileAccountOut struct {
	AccountID  string     `json:"account_id"`
	Difference tool.Money `json:"difference,omitzero"`
	Resolution string     `json:"resolution,omitzero"`
}

func reconcileAccount(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "reconcile_account",
		Description: "Proposes a reconciliation step on an account: record the balance the institution reports at a date, resolve the open difference of a recorded balance, or unlock reconciled postings from a date. " +
			"Use it when the user says what the bank shows or asks to reconcile. " +
			"Do not use it to correct a single transaction: change_transaction does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, userID int64, in reconcileAccountIn) (tool.Preview, error) {
		pv, _, err := planReconcile(ctx, svc, userID, in)
		return pv, err
	}, func(ctx context.Context, userID int64, in reconcileAccountIn) (reconcileAccountOut, error) {
		_, run, err := planReconcile(ctx, svc, userID, in)
		if err != nil {
			return reconcileAccountOut{}, err
		}
		return run()
	})
}

func planReconcile(ctx context.Context, svc *app.Service, userID int64, in reconcileAccountIn) (tool.Preview, func() (reconcileAccountOut, error), error) {
	action := string(in.Action)
	pv := tool.Preview{Action: "reconcile_account"}
	id, err := requiredID(in.AccountID, "account_id")
	if err != nil {
		return pv, nil, err
	}
	given := map[string]bool{"account_id": true, "date": !in.Date.IsZero(), "amount": in.Amount != "", "resolution": in.Resolution != ""}
	var required []string
	switch in.Action {
	case "record_balance":
		required = []string{"date", "amount"}
	case "resolve_difference":
		required = []string{"resolution"}
	default:
		required = []string{"date"}
	}
	if err := checkFields(action, given, append([]string{"account_id"}, required...)); err != nil {
		return pv, nil, err
	}
	a, err := svc.Account(ctx, userID, id)
	if err != nil {
		return pv, nil, err
	}
	pv.Target = a.Name
	switch in.Action {
	case "record_balance":
		unit, err := svc.AmountOf(ctx, 0, a.Instrument)
		if err != nil {
			return pv, nil, err
		}
		amount, err := tool.ParseAmount("amount", in.Amount, unit)
		if err != nil {
			return pv, nil, err
		}
		pv.Changes = []tool.Change{{Field: "amount", After: tool.MoneyValue(amount)}, {Field: "date", After: tool.DateValue(in.Date.Time)}}
		return pv, func() (reconcileAccountOut, error) {
			res, err := svc.AssertBalance(ctx, userID, a.ID, in.Date.Time, amount, app.SourceManual)
			return assertionOut(a.ID.String(), res), err
		}, nil
	case "resolve_difference":
		st, err := svc.ReconciliationStatus(ctx, userID, a.ID)
		if err != nil {
			return pv, nil, err
		}
		if st.Open == nil {
			return pv, nil, tool.InvalidArgument("account_id", "has no open difference")
		}
		pv.Basis = st.Open.AssertionID.String() + ":" + st.Open.Difference.Decimal()
		pv.Changes = []tool.Change{
			{Field: "amount", After: tool.MoneyValue(st.Open.Difference)},
			{Field: "date", After: tool.DateValue(st.Open.Date)},
			{Field: "status", Before: tool.TextValue("open difference"), After: tool.TextValue(string(in.Resolution))},
		}
		return pv, func() (reconcileAccountOut, error) {
			res, err := svc.ResolveAssertion(ctx, userID, st.Open.AssertionID, domain.Resolution(in.Resolution))
			return assertionOut(a.ID.String(), res), err
		}, nil
	default:
		pv.Changes = []tool.Change{{Field: "date", After: tool.DateValue(in.Date.Time)}, {Field: "status", Before: tool.TextValue("reconciled"), After: tool.TextValue("unlocked")}}
		return pv, func() (reconcileAccountOut, error) {
			return reconcileAccountOut{AccountID: a.ID.String()}, svc.Unlock(ctx, userID, a.ID, in.Date.Time)
		}, nil
	}
}

func assertionOut(accountID string, res app.AssertionResult) reconcileAccountOut {
	d := tool.MoneyOf(res.Difference)
	return reconcileAccountOut{AccountID: accountID, Difference: d, Resolution: string(res.Resolution)}
}
