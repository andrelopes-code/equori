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

type manageAccountsAndPayeesAction string

func (manageAccountsAndPayeesAction) Values() []string {
	return []string{"create_account", "update_account", "close_account", "reopen_account", "merge_category", "create_payee", "rename_payee", "merge_payee", "create_institution", "rename_tag", "merge_tag", "delete_tag"}
}

type manageAccountsAndPayeesClass string

func (manageAccountsAndPayeesClass) Values() []string {
	return []string{"asset", "liability", "equity", "income", "expense"}
}

type manageAccountsAndPayeesKind string

func (manageAccountsAndPayeesKind) Values() []string {
	return []string{"checking", "savings", "cash", "wallet", "benefit", "reserve", "brokerage", "receivable", "loan", "credit_card", "other"}
}

type manageAccountsAndPayeesIn struct {
	Action        manageAccountsAndPayeesAction `json:"action" jsonschema:"operation to propose"`
	AccountID     string                        `json:"account_id,omitzero" jsonschema:"account or category to change or merge, from list_accounts"`
	Name          string                        `json:"name,omitzero" jsonschema:"name of the new or renamed account, category, payee, institution or tag"`
	Class         manageAccountsAndPayeesClass  `json:"class,omitzero" jsonschema:"for create_account: class of the new account; income and expense create categories"`
	Kind          manageAccountsAndPayeesKind   `json:"kind,omitzero" jsonschema:"for create_account of an asset or liability: kind of account"`
	Currency      string                        `json:"currency,omitzero" jsonschema:"for create_account: currency or instrument code; the base currency when absent"`
	ParentID      string                        `json:"parent_id,omitzero" jsonschema:"for create_account and update_account: parent account or category"`
	InstitutionID string                        `json:"institution_id,omitzero" jsonschema:"for create_account and update_account: institution from list_payees_and_tags"`
	Date          tool.Date                     `json:"date,omitzero" jsonschema:"for close_account: closing date; today when absent"`
	IntoID        string                        `json:"into_id,omitzero" jsonschema:"for merge_category and merge_payee: category or payee that remains"`
	PayeeID       string                        `json:"payee_id,omitzero" jsonschema:"for rename_payee and merge_payee: payee to change, from list_payees_and_tags"`
	Tag           string                        `json:"tag,omitzero" jsonschema:"for rename_tag, merge_tag and delete_tag: tag to change, from list_payees_and_tags"`
	IntoTag       string                        `json:"into_tag,omitzero" jsonschema:"for merge_tag: tag that remains"`
}

type manageAccountsAndPayeesOut struct {
	Action string `json:"action"`
	ID     string `json:"id"`
	Name   string `json:"name"`
}

// checkFields requires the fields an action needs and rejects the ones it does not read.
func checkFields(action string, given map[string]bool, required []string, optional ...string) error {
	for _, f := range required {
		if !given[f] {
			return tool.InvalidArgument(f, "is required for "+action)
		}
	}
	return unusedFields(action, given, append(required, optional...)...)
}

func manageAccountsAndPayees(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "manage_accounts_and_payees",
		Description: "Proposes a change to accounts, categories, payees or institutions: create, rename or move an account or category, close or reopen it, merge a category or payee into another, create or rename a payee, create an institution, rename, merge or delete a tag. " +
			"Use it when the user asks to organize accounts, categories, payees or tags. " +
			"Do not use it for card settings: manage_card does. " +
			"Merging cannot be undone; the user confirms every change.",
		Effect: tool.Destructive,
	}, func(ctx context.Context, userID int64, in manageAccountsAndPayeesIn) (tool.Preview, error) {
		pv, _, err := planOrganize(ctx, svc, userID, in)
		return pv, err
	}, func(ctx context.Context, userID int64, in manageAccountsAndPayeesIn) (manageAccountsAndPayeesOut, error) {
		_, run, err := planOrganize(ctx, svc, userID, in)
		if err != nil {
			return manageAccountsAndPayeesOut{}, err
		}
		return run()
	})
}

func institutionName(ctx context.Context, svc *app.Service, userID int64, id uuid.UUID) (string, error) {
	all, err := allPages(func(p page.Request[app.InstitutionKey]) ([]app.Institution, *app.InstitutionKey, error) {
		return svc.ListInstitutions(ctx, userID, p)
	})
	if err != nil {
		return "", err
	}
	for _, i := range all {
		if i.ID == id {
			return i.Name, nil
		}
	}
	return "", app.ErrNotFound
}

func payeeByID(ctx context.Context, svc *app.Service, userID int64, id uuid.UUID) (app.Payee, error) {
	all, err := allPages(func(p page.Request[app.PayeeKey]) ([]app.Payee, *app.PayeeKey, error) {
		return svc.ListPayees(ctx, userID, p)
	})
	if err != nil {
		return app.Payee{}, err
	}
	for _, py := range all {
		if py.ID == id {
			return py, nil
		}
	}
	return app.Payee{}, app.ErrNotFound
}

// accountName returns the name of an optional account reference; the zero ID has no name.
func accountName(ctx context.Context, svc *app.Service, userID int64, id uuid.UUID) (string, error) {
	if id == uuid.Nil {
		return "", nil
	}
	a, err := svc.Account(ctx, userID, id)
	return a.Name, err
}

func planOrganize(ctx context.Context, svc *app.Service, userID int64, in manageAccountsAndPayeesIn) (tool.Preview, func() (manageAccountsAndPayeesOut, error), error) {
	action := string(in.Action)
	pv := tool.Preview{Action: "manage_accounts_and_payees"}
	given := map[string]bool{
		"account_id": in.AccountID != "", "name": in.Name != "", "class": in.Class != "", "kind": in.Kind != "", "currency": in.Currency != "",
		"parent_id": in.ParentID != "", "institution_id": in.InstitutionID != "", "date": !in.Date.IsZero(), "into_id": in.IntoID != "", "payee_id": in.PayeeID != "",
		"tag": in.Tag != "", "into_tag": in.IntoTag != "",
	}
	accountID, err := optionalID(in.AccountID, "account_id")
	if err != nil {
		return pv, nil, err
	}
	parentID, err := optionalID(in.ParentID, "parent_id")
	if err != nil {
		return pv, nil, err
	}
	institutionID, err := optionalID(in.InstitutionID, "institution_id")
	if err != nil {
		return pv, nil, err
	}
	intoID, err := optionalID(in.IntoID, "into_id")
	if err != nil {
		return pv, nil, err
	}
	payeeID, err := optionalID(in.PayeeID, "payee_id")
	if err != nil {
		return pv, nil, err
	}
	text := tool.TextValue
	switch in.Action {
	case "create_account":
		required := []string{"name", "class"}
		if in.Class == "asset" || in.Class == "liability" {
			required = append(required, "kind")
		}
		if err := checkFields(action, given, required, "kind", "currency", "parent_id", "institution_id"); err != nil {
			return pv, nil, err
		}
		settings, err := svc.Settings(ctx, userID)
		if err != nil {
			return pv, nil, err
		}
		currency := settings.BaseCurrency
		if in.Currency != "" {
			currency = money.Currency(in.Currency)
		}
		a := domain.Account{
			Name: in.Name, Class: domain.Class(in.Class), Kind: domain.Kind(in.Kind), Instrument: currency,
			ParentID: parentID, InstitutionID: institutionID, OpenedOn: svc.Today(),
		}
		pv.Target = in.Name
		pv.Changes = []tool.Change{{Field: "name", After: text(in.Name)}, {Field: "class", After: text(string(in.Class))}}
		if in.Kind != "" {
			pv.Changes = append(pv.Changes, tool.Change{Field: "kind", After: text(string(in.Kind))})
		}
		pv.Changes = append(pv.Changes, tool.Change{Field: "currency", After: text(string(currency))})
		if parentID != uuid.Nil {
			parent, err := accountName(ctx, svc, userID, parentID)
			if err != nil {
				return pv, nil, err
			}
			pv.Changes = append(pv.Changes, tool.Change{Field: "parent", After: text(parent)})
		}
		if institutionID != uuid.Nil {
			name, err := institutionName(ctx, svc, userID, institutionID)
			if err != nil {
				return pv, nil, err
			}
			pv.Changes = append(pv.Changes, tool.Change{Field: "institution", After: text(name)})
		}
		return pv, func() (manageAccountsAndPayeesOut, error) {
			created, err := svc.CreateAccount(ctx, userID, a)
			return manageAccountsAndPayeesOut{Action: action, ID: created.ID.String(), Name: created.Name}, err
		}, nil
	case "update_account":
		if err := checkFields(action, given, []string{"account_id"}, "name", "parent_id", "institution_id"); err != nil {
			return pv, nil, err
		}
		if in.Name == "" && parentID == uuid.Nil && institutionID == uuid.Nil {
			return pv, nil, tool.InvalidArgument("name", "one of name, parent_id or institution_id is required for update_account")
		}
		a, err := svc.Account(ctx, userID, accountID)
		if err != nil {
			return pv, nil, err
		}
		pv.Target = a.Name
		var patch app.AccountPatch
		if in.Name != "" {
			patch.Name = &in.Name
			pv.Changes = append(pv.Changes, tool.Change{Field: "name", Before: text(a.Name), After: text(in.Name)})
		}
		if parentID != uuid.Nil {
			before, err := accountName(ctx, svc, userID, a.ParentID)
			if err != nil {
				return pv, nil, err
			}
			after, err := accountName(ctx, svc, userID, parentID)
			if err != nil {
				return pv, nil, err
			}
			patch.ParentID = &parentID
			pv.Changes = append(pv.Changes, tool.Change{Field: "parent", Before: text(before), After: text(after)})
		}
		if institutionID != uuid.Nil {
			var before string
			if a.InstitutionID != uuid.Nil {
				if before, err = institutionName(ctx, svc, userID, a.InstitutionID); err != nil {
					return pv, nil, err
				}
			}
			after, err := institutionName(ctx, svc, userID, institutionID)
			if err != nil {
				return pv, nil, err
			}
			patch.InstitutionID = &institutionID
			pv.Changes = append(pv.Changes, tool.Change{Field: "institution", Before: text(before), After: text(after)})
		}
		return pv, func() (manageAccountsAndPayeesOut, error) {
			updated, err := svc.UpdateAccount(ctx, userID, a.ID, patch)
			return manageAccountsAndPayeesOut{Action: action, ID: a.ID.String(), Name: updated.Name}, err
		}, nil
	case "close_account", "reopen_account":
		closing := in.Action == "close_account"
		optional := []string{}
		if closing {
			optional = append(optional, "date")
		}
		if err := checkFields(action, given, []string{"account_id"}, optional...); err != nil {
			return pv, nil, err
		}
		a, err := svc.Account(ctx, userID, accountID)
		if err != nil {
			return pv, nil, err
		}
		pv.Target = a.Name
		date := svc.Today()
		if !in.Date.IsZero() {
			date = in.Date.Time
		}
		if closing {
			pv.Changes = []tool.Change{{Field: "status", Before: text("active"), After: text("closed")}, {Field: "date", After: tool.DateValue(date)}}
		} else {
			pv.Changes = []tool.Change{{Field: "status", Before: text("closed"), After: text("active")}}
		}
		return pv, func() (manageAccountsAndPayeesOut, error) {
			if closing {
				return manageAccountsAndPayeesOut{Action: action, ID: a.ID.String(), Name: a.Name}, svc.CloseAccount(ctx, userID, a.ID, date)
			}
			_, err := svc.ReopenAccount(ctx, userID, a.ID)
			return manageAccountsAndPayeesOut{Action: action, ID: a.ID.String(), Name: a.Name}, err
		}, nil
	case "merge_category":
		if err := checkFields(action, given, []string{"account_id", "into_id"}); err != nil {
			return pv, nil, err
		}
		from, err := svc.Account(ctx, userID, accountID)
		if err != nil {
			return pv, nil, err
		}
		into, err := svc.Account(ctx, userID, intoID)
		if err != nil {
			return pv, nil, err
		}
		pv.Target, pv.Destructive = from.Name, true
		pv.Changes = []tool.Change{{Field: "category", Before: text(from.Name), After: text(into.Name)}}
		return pv, func() (manageAccountsAndPayeesOut, error) {
			merged, err := svc.MergeCategories(ctx, userID, from.ID, into.ID)
			return manageAccountsAndPayeesOut{Action: action, ID: merged.ID.String(), Name: merged.Name}, err
		}, nil
	case "create_payee", "create_institution":
		if err := checkFields(action, given, []string{"name"}); err != nil {
			return pv, nil, err
		}
		pv.Target = in.Name
		pv.Changes = []tool.Change{{Field: "name", After: text(in.Name)}}
		return pv, func() (manageAccountsAndPayeesOut, error) {
			if in.Action == "create_payee" {
				p, err := svc.CreatePayee(ctx, userID, in.Name)
				return manageAccountsAndPayeesOut{Action: action, ID: p.ID.String(), Name: p.Name}, err
			}
			i, err := svc.CreateInstitution(ctx, userID, app.Institution{Name: in.Name})
			return manageAccountsAndPayeesOut{Action: action, ID: i.ID.String(), Name: i.Name}, err
		}, nil
	case "rename_payee":
		if err := checkFields(action, given, []string{"payee_id", "name"}); err != nil {
			return pv, nil, err
		}
		p, err := payeeByID(ctx, svc, userID, payeeID)
		if err != nil {
			return pv, nil, err
		}
		pv.Target = p.Name
		pv.Changes = []tool.Change{{Field: "name", Before: text(p.Name), After: text(in.Name)}}
		return pv, func() (manageAccountsAndPayeesOut, error) {
			renamed, err := svc.RenamePayee(ctx, userID, p.ID, in.Name)
			return manageAccountsAndPayeesOut{Action: action, ID: p.ID.String(), Name: renamed.Name}, err
		}, nil
	case "rename_tag":
		if err := checkFields(action, given, []string{"tag", "name"}); err != nil {
			return pv, nil, err
		}
		tag, err := svc.Tag(ctx, userID, in.Tag)
		if err != nil {
			return pv, nil, err
		}
		name, err := domain.NormalizeTag(in.Name, "name")
		if err != nil {
			return pv, nil, err
		}
		pv.Target = tag.Name
		pv.Changes = []tool.Change{{Field: "name", Before: text(tag.Name), After: text(name)}}
		return pv, func() (manageAccountsAndPayeesOut, error) {
			renamed, err := svc.RenameTag(ctx, userID, tag.Name, name)
			return manageAccountsAndPayeesOut{Action: action, Name: renamed.Name}, err
		}, nil
	case "merge_tag":
		if err := checkFields(action, given, []string{"tag", "into_tag"}); err != nil {
			return pv, nil, err
		}
		from, err := svc.Tag(ctx, userID, in.Tag)
		if err != nil {
			return pv, nil, err
		}
		pv.Target, pv.Destructive = from.Name, true
		pv.Changes = []tool.Change{{Field: "tags", Before: text(from.Name), After: text(in.IntoTag)}}
		return pv, func() (manageAccountsAndPayeesOut, error) {
			merged, err := svc.MergeTag(ctx, userID, from.Name, in.IntoTag)
			return manageAccountsAndPayeesOut{Action: action, Name: merged.Name}, err
		}, nil
	case "delete_tag":
		if err := checkFields(action, given, []string{"tag"}); err != nil {
			return pv, nil, err
		}
		tag, err := svc.Tag(ctx, userID, in.Tag)
		if err != nil {
			return pv, nil, err
		}
		pv.Target, pv.Destructive = tag.Name, true
		return pv, func() (manageAccountsAndPayeesOut, error) {
			return manageAccountsAndPayeesOut{Action: action, Name: tag.Name}, svc.DeleteTag(ctx, userID, tag.Name)
		}, nil
	default:
		if err := checkFields(action, given, []string{"payee_id", "into_id"}); err != nil {
			return pv, nil, err
		}
		from, err := payeeByID(ctx, svc, userID, payeeID)
		if err != nil {
			return pv, nil, err
		}
		into, err := payeeByID(ctx, svc, userID, intoID)
		if err != nil {
			return pv, nil, err
		}
		pv.Target, pv.Destructive = from.Name, true
		pv.Changes = []tool.Change{{Field: "payee", Before: text(from.Name), After: text(into.Name)}}
		return pv, func() (manageAccountsAndPayeesOut, error) {
			merged, err := svc.MergePayees(ctx, userID, from.ID, into.ID)
			return manageAccountsAndPayeesOut{Action: action, ID: merged.ID.String(), Name: merged.Name}, err
		}, nil
	}
}
