package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type listAccountsIn struct {
	Class         accountClass `json:"class,omitzero" jsonschema:"keep only accounts of this class; income and expense accounts are the categories of transactions"`
	IncludeClosed bool         `json:"include_closed,omitzero" jsonschema:"also list closed accounts"`
}

type accountView struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Class      string `json:"class"`
	Kind       string `json:"kind,omitzero" jsonschema:"kind of an asset or liability account, such as checking or credit_card"`
	Currency   string `json:"currency" jsonschema:"currency or instrument code of the account"`
	ParentID   string `json:"parent_id,omitzero"`
	ParentName string `json:"parent_name,omitzero"`
	SystemRole string `json:"system_role,omitzero" jsonschema:"set on accounts the ledger creates, such as uncategorized_expense"`
	Closed     bool   `json:"closed,omitzero"`
}

type listAccountsOut struct {
	Accounts []accountView `json:"accounts"`
}

func listAccounts(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "list_accounts",
		Description: "Lists the user's accounts by class and then name, with the IDs the other tools take. " +
			"Income and expense accounts are the categories of transactions; a child account carries its parent.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, userID int64, in listAccountsIn) (listAccountsOut, error) {
		byID, all, err := allAccounts(ctx, svc, userID)
		if err != nil {
			return listAccountsOut{}, err
		}
		out := listAccountsOut{Accounts: []accountView{}}
		for _, a := range all {
			if (in.Class != "" && string(a.Class) != string(in.Class)) || (a.ClosedOn != nil && !in.IncludeClosed) {
				continue
			}
			v := accountView{
				ID: a.ID.String(), Name: a.Name, Class: string(a.Class), Kind: string(a.Kind), Currency: string(a.Instrument),
				SystemRole: string(a.SystemRole), Closed: a.ClosedOn != nil,
			}
			if a.ParentID != uuid.Nil {
				v.ParentID, v.ParentName = a.ParentID.String(), byID[a.ParentID].Name
			}
			out.Accounts = append(out.Accounts, v)
		}
		return out, nil
	})
}

type basis string

func (basis) Values() []string { return []string{string(app.BasisBooked), string(app.BasisSettled)} }

type balanceClass string

func (balanceClass) Values() []string { return []string{"asset", "liability", "equity"} }

type getBalancesIn struct {
	Date  tool.Date    `json:"date,omitzero" jsonschema:"balances at the end of this date; today when absent"`
	Basis basis        `json:"basis,omitzero" jsonschema:"booked places a posting at the transaction date, settled at the institution's settlement date; booked when absent"`
	Class balanceClass `json:"class,omitzero" jsonschema:"keep only accounts of this class"`
}

type balanceView struct {
	AccountID   string     `json:"account_id"`
	AccountName string     `json:"account_name"`
	Class       string     `json:"class"`
	Balance     tool.Money `json:"balance"`
}

type getBalancesOut struct {
	Date     tool.Date     `json:"date"`
	Basis    string        `json:"basis"`
	Balances []balanceView `json:"balances"`
}

func getBalances(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_balances",
		Description: "Returns the balance of every asset, liability and equity account at a date, by class and then account name. " +
			"Accounts with a zero balance are omitted. Totals of income and expense categories come from get_category_totals.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, userID int64, in getBalancesIn) (getBalancesOut, error) {
		date := in.Date.Time
		if in.Date.IsZero() {
			date = svc.Today()
		}
		b := app.Basis(in.Basis)
		if b == "" {
			b = app.BasisBooked
		}
		balances, err := svc.BalancesAt(ctx, userID, date, b)
		if err != nil {
			return getBalancesOut{}, err
		}
		amounts := make(map[uuid.UUID]tool.Money, len(balances))
		for _, bal := range balances {
			if !bal.Amount.IsZero() {
				amounts[bal.AccountID] = tool.MoneyOf(bal.Amount)
			}
		}
		_, all, err := allAccounts(ctx, svc, userID)
		if err != nil {
			return getBalancesOut{}, err
		}
		out := getBalancesOut{Date: tool.DateOf(date), Basis: string(b), Balances: []balanceView{}}
		for _, a := range all {
			m, ok := amounts[a.ID]
			if !ok || (in.Class != "" && string(a.Class) != string(in.Class)) {
				continue
			}
			out.Balances = append(out.Balances, balanceView{AccountID: a.ID.String(), AccountName: a.Name, Class: string(a.Class), Balance: m})
		}
		return out, nil
	})
}
