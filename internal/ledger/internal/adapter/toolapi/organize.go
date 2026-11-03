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
	return []string{"create_account", "update_account", "close_account", "reopen_account", "merge_category", "create_payee", "rename_payee", "merge_payee", "create_institution", "delete_institution", "rename_tag", "merge_tag", "delete_tag"}
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
	InstitutionID string                        `json:"institution_id,omitzero" jsonschema:"for create_account, update_account and delete_institution: institution from list_payees_and_tags"`
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

type organizeRun func() (manageAccountsAndPayeesOut, error)

// organizeCall holds the parsed arguments of one manage_accounts_and_payees call.
type organizeCall struct {
	svc           *app.Service
	booksID       int64
	in            manageAccountsAndPayeesIn
	action        string
	given         map[string]bool
	accountID     uuid.UUID
	parentID      uuid.UUID
	institutionID uuid.UUID
	intoID        uuid.UUID
	payeeID       uuid.UUID
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
		Description: "Proposes a change to accounts, categories, payees or institutions: create, rename or move an account or category, close or reopen it, merge a category or payee into another, create or rename a payee, create an institution, delete an institution no account uses, rename, merge or delete a tag. " +
			"Use it when the user asks to organize accounts, categories, payees or tags. " +
			"Do not use it for card settings: manage_card does. " +
			"Merging cannot be undone; the user confirms every change.",
		Effect: tool.Destructive,
	}, func(ctx context.Context, booksID int64, in manageAccountsAndPayeesIn) (tool.Preview, error) {
		pv, _, err := planOrganize(ctx, svc, booksID, in)
		return pv, err
	}, func(ctx context.Context, booksID int64, in manageAccountsAndPayeesIn) (manageAccountsAndPayeesOut, error) {
		_, run, err := planOrganize(ctx, svc, booksID, in)
		if err != nil {
			return manageAccountsAndPayeesOut{}, err
		}

		return run()
	})
}

func institutionName(ctx context.Context, svc *app.Service, booksID int64, id uuid.UUID) (string, error) {
	all, err := allPages(func(p page.Request[app.InstitutionKey]) ([]app.Institution, *app.InstitutionKey, error) {
		return svc.ListInstitutions(ctx, booksID, p)
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

func payeeByID(ctx context.Context, svc *app.Service, booksID int64, id uuid.UUID) (app.Payee, error) {
	all, err := allPages(func(p page.Request[app.PayeeKey]) ([]app.Payee, *app.PayeeKey, error) {
		return svc.ListPayees(ctx, booksID, p)
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
func accountName(ctx context.Context, svc *app.Service, booksID int64, id uuid.UUID) (string, error) {
	if id == uuid.Nil {
		return "", nil
	}

	a, err := svc.Account(ctx, booksID, id)

	return a.Name, err
}

func planOrganize(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageAccountsAndPayeesIn,
) (tool.Preview, organizeRun, error) {
	pv := tool.Preview{Action: "manage_accounts_and_payees"}

	c, err := newOrganizeCall(svc, booksID, in)
	if err != nil {
		return pv, nil, err
	}

	run, err := c.plan(ctx, &pv)

	return pv, run, err
}

func newOrganizeCall(
	svc *app.Service,
	booksID int64,
	in manageAccountsAndPayeesIn,
) (organizeCall, error) {
	accountID, err := optionalID(in.AccountID, "account_id")
	if err != nil {
		return organizeCall{}, err
	}

	parentID, err := optionalID(in.ParentID, "parent_id")
	if err != nil {
		return organizeCall{}, err
	}

	institutionID, err := optionalID(in.InstitutionID, "institution_id")
	if err != nil {
		return organizeCall{}, err
	}

	intoID, err := optionalID(in.IntoID, "into_id")
	if err != nil {
		return organizeCall{}, err
	}

	payeeID, err := optionalID(in.PayeeID, "payee_id")
	if err != nil {
		return organizeCall{}, err
	}

	return organizeCall{
		svc:           svc,
		booksID:       booksID,
		in:            in,
		action:        string(in.Action),
		given:         givenFields(in),
		accountID:     accountID,
		parentID:      parentID,
		institutionID: institutionID,
		intoID:        intoID,
		payeeID:       payeeID,
	}, nil
}

func givenFields(in manageAccountsAndPayeesIn) map[string]bool {
	return map[string]bool{
		"account_id": in.AccountID != "", "name": in.Name != "", "class": in.Class != "", "kind": in.Kind != "", "currency": in.Currency != "",
		"parent_id": in.ParentID != "", "institution_id": in.InstitutionID != "", "date": !in.Date.IsZero(), "into_id": in.IntoID != "", "payee_id": in.PayeeID != "",
		"tag": in.Tag != "", "into_tag": in.IntoTag != "",
	}
}

func (c organizeCall) plan(ctx context.Context, pv *tool.Preview) (organizeRun, error) {
	switch c.in.Action {
	case "create_account":
		return c.planCreateAccount(ctx, pv)
	case "update_account":
		return c.planUpdateAccount(ctx, pv)
	case "close_account", "reopen_account":
		return c.planCloseOrReopenAccount(ctx, pv)
	case "merge_category":
		return c.planMergeCategory(ctx, pv)
	case "create_payee", "create_institution":
		return c.planCreatePayeeOrInstitution(ctx, pv)
	case "rename_payee":
		return c.planRenamePayee(ctx, pv)
	case "delete_institution":
		return c.planDeleteInstitution(ctx, pv)
	case "rename_tag":
		return c.planRenameTag(ctx, pv)
	case "merge_tag":
		return c.planMergeTag(ctx, pv)
	case "delete_tag":
		return c.planDeleteTag(ctx, pv)
	default:
		return c.planMergePayee(ctx, pv)
	}
}

func (c organizeCall) planCreateAccount(ctx context.Context, pv *tool.Preview) (organizeRun, error) {
	required := []string{"name", "class"}
	if c.in.Class == "asset" || c.in.Class == "liability" {
		required = append(required, "kind")
	}

	if err := c.check(
		required,
		"kind",
		"currency",
		"parent_id",
		"institution_id",
	); err != nil {
		return nil, err
	}

	settings, err := c.svc.Settings(ctx, c.booksID)
	if err != nil {
		return nil, err
	}

	currency := settings.BaseCurrency
	if c.in.Currency != "" {
		currency = money.Currency(c.in.Currency)
	}

	a := domain.Account{
		Name: c.in.Name, Class: domain.Class(c.in.Class), Kind: domain.Kind(c.in.Kind), Instrument: currency,
		ParentID: c.parentID, InstitutionID: c.institutionID,
	}
	pv.Target = c.in.Name

	if err := c.describeNewAccount(ctx, pv, currency); err != nil {
		return nil, err
	}

	return func() (manageAccountsAndPayeesOut, error) {
		created, err := c.svc.CreateAccount(ctx, c.booksID, a)
		return manageAccountsAndPayeesOut{Action: c.action, ID: created.ID.String(), Name: created.Name}, err
	}, nil
}

func (c organizeCall) describeNewAccount(
	ctx context.Context,
	pv *tool.Preview,
	currency money.Currency,
) error {
	text := tool.TextValue

	pv.Changes = []tool.Change{{Field: "name", After: text(c.in.Name)}, {Field: "class", After: text(string(c.in.Class))}}
	if c.in.Kind != "" {
		pv.Changes = append(pv.Changes, tool.Change{Field: "kind", After: text(string(c.in.Kind))})
	}

	pv.Changes = append(pv.Changes, tool.Change{Field: "currency", After: text(string(currency))})
	if c.parentID != uuid.Nil {
		parent, err := accountName(ctx, c.svc, c.booksID, c.parentID)
		if err != nil {
			return err
		}

		pv.Changes = append(pv.Changes, tool.Change{Field: "parent", After: text(parent)})
	}

	if c.institutionID != uuid.Nil {
		name, err := institutionName(ctx, c.svc, c.booksID, c.institutionID)
		if err != nil {
			return err
		}

		pv.Changes = append(pv.Changes, tool.Change{Field: "institution", After: text(name)})
	}

	return nil
}

func (c organizeCall) planUpdateAccount(ctx context.Context, pv *tool.Preview) (organizeRun, error) {
	text := tool.TextValue

	if err := c.check([]string{"account_id"}, "name", "parent_id", "institution_id"); err != nil {
		return nil, err
	}

	if c.in.Name == "" && c.parentID == uuid.Nil && c.institutionID == uuid.Nil {
		return nil, tool.InvalidArgument("name", "one of name, parent_id or institution_id is required for update_account")
	}

	a, err := c.svc.Account(ctx, c.booksID, c.accountID)
	if err != nil {
		return nil, err
	}

	pv.Target = a.Name

	var patch app.AccountPatch
	if c.in.Name != "" {
		patch.Name = &c.in.Name
		pv.Changes = append(pv.Changes, tool.Change{Field: "name", Before: text(a.Name), After: text(c.in.Name)})
	}

	if err := c.patchParent(ctx, pv, &patch, a.ParentID); err != nil {
		return nil, err
	}

	if err := c.patchInstitution(ctx, pv, &patch, a.InstitutionID); err != nil {
		return nil, err
	}

	return func() (manageAccountsAndPayeesOut, error) {
		updated, err := c.svc.UpdateAccount(ctx, c.booksID, a.ID, patch)
		return manageAccountsAndPayeesOut{Action: c.action, ID: a.ID.String(), Name: updated.Name}, err
	}, nil
}

func (c organizeCall) patchParent(
	ctx context.Context,
	pv *tool.Preview,
	patch *app.AccountPatch,
	current uuid.UUID,
) error {
	if c.parentID == uuid.Nil {
		return nil
	}

	text := tool.TextValue

	before, err := accountName(ctx, c.svc, c.booksID, current)
	if err != nil {
		return err
	}

	after, err := accountName(ctx, c.svc, c.booksID, c.parentID)
	if err != nil {
		return err
	}

	patch.ParentID = &c.parentID

	pv.Changes = append(pv.Changes, tool.Change{Field: "parent", Before: text(before), After: text(after)})

	return nil
}

func (c organizeCall) patchInstitution(
	ctx context.Context,
	pv *tool.Preview,
	patch *app.AccountPatch,
	current uuid.UUID,
) error {
	if c.institutionID == uuid.Nil {
		return nil
	}

	text := tool.TextValue

	var before string
	if current != uuid.Nil {
		var err error
		if before, err = institutionName(ctx, c.svc, c.booksID, current); err != nil {
			return err
		}
	}

	after, err := institutionName(ctx, c.svc, c.booksID, c.institutionID)
	if err != nil {
		return err
	}

	patch.InstitutionID = &c.institutionID

	pv.Changes = append(pv.Changes, tool.Change{Field: "institution", Before: text(before), After: text(after)})

	return nil
}

func (c organizeCall) planCloseOrReopenAccount(ctx context.Context, pv *tool.Preview) (organizeRun, error) {
	text := tool.TextValue
	closing := c.in.Action == "close_account"

	optional := []string{}
	if closing {
		optional = append(optional, "date")
	}

	if err := c.check([]string{"account_id"}, optional...); err != nil {
		return nil, err
	}

	a, err := c.svc.Account(ctx, c.booksID, c.accountID)
	if err != nil {
		return nil, err
	}

	pv.Target = a.Name

	date := c.svc.Today(ctx)
	if !c.in.Date.IsZero() {
		date = c.in.Date.Time
	}

	if closing {
		pv.Changes = []tool.Change{{Field: "status", Before: text("active"), After: text("closed")}, {Field: "date", After: tool.DateValue(date)}}
	} else {
		pv.Changes = []tool.Change{{Field: "status", Before: text("closed"), After: text("active")}}
	}

	return func() (manageAccountsAndPayeesOut, error) {
		if closing {
			return manageAccountsAndPayeesOut{Action: c.action, ID: a.ID.String(), Name: a.Name}, c.svc.CloseAccount(ctx, c.booksID, a.ID, date)
		}

		_, err := c.svc.ReopenAccount(ctx, c.booksID, a.ID)

		return manageAccountsAndPayeesOut{Action: c.action, ID: a.ID.String(), Name: a.Name}, err
	}, nil
}

func (c organizeCall) planMergeCategory(ctx context.Context, pv *tool.Preview) (organizeRun, error) {
	text := tool.TextValue

	if err := c.check([]string{"account_id", "into_id"}); err != nil {
		return nil, err
	}

	from, err := c.svc.Account(ctx, c.booksID, c.accountID)
	if err != nil {
		return nil, err
	}

	into, err := c.svc.Account(ctx, c.booksID, c.intoID)
	if err != nil {
		return nil, err
	}

	pv.Target, pv.Destructive = from.Name, true
	pv.Changes = []tool.Change{{Field: "category", Before: text(from.Name), After: text(into.Name)}}

	return func() (manageAccountsAndPayeesOut, error) {
		merged, err := c.svc.MergeCategories(ctx, c.booksID, from.ID, into.ID)
		return manageAccountsAndPayeesOut{Action: c.action, ID: merged.ID.String(), Name: merged.Name}, err
	}, nil
}

func (c organizeCall) planCreatePayeeOrInstitution(ctx context.Context, pv *tool.Preview) (organizeRun, error) {
	text := tool.TextValue

	if err := c.check([]string{"name"}); err != nil {
		return nil, err
	}

	pv.Target = c.in.Name
	pv.Changes = []tool.Change{{Field: "name", After: text(c.in.Name)}}

	return func() (manageAccountsAndPayeesOut, error) {
		if c.in.Action == "create_payee" {
			p, err := c.svc.CreatePayee(ctx, c.booksID, c.in.Name)
			return manageAccountsAndPayeesOut{Action: c.action, ID: p.ID.String(), Name: p.Name}, err
		}

		i, err := c.svc.CreateInstitution(ctx, c.booksID, app.Institution{Name: c.in.Name})

		return manageAccountsAndPayeesOut{Action: c.action, ID: i.ID.String(), Name: i.Name}, err
	}, nil
}

func (c organizeCall) planRenamePayee(ctx context.Context, pv *tool.Preview) (organizeRun, error) {
	text := tool.TextValue

	if err := c.check([]string{"payee_id", "name"}); err != nil {
		return nil, err
	}

	p, err := payeeByID(ctx, c.svc, c.booksID, c.payeeID)
	if err != nil {
		return nil, err
	}

	pv.Target = p.Name
	pv.Changes = []tool.Change{{Field: "name", Before: text(p.Name), After: text(c.in.Name)}}

	return func() (manageAccountsAndPayeesOut, error) {
		renamed, err := c.svc.RenamePayee(ctx, c.booksID, p.ID, c.in.Name)
		return manageAccountsAndPayeesOut{Action: c.action, ID: p.ID.String(), Name: renamed.Name}, err
	}, nil
}

func (c organizeCall) planRenameTag(ctx context.Context, pv *tool.Preview) (organizeRun, error) {
	text := tool.TextValue

	if err := c.check([]string{"tag", "name"}); err != nil {
		return nil, err
	}

	tag, err := c.svc.Tag(ctx, c.booksID, c.in.Tag)
	if err != nil {
		return nil, err
	}

	name, err := domain.NormalizeTag(c.in.Name, "name")
	if err != nil {
		return nil, err
	}

	pv.Target = tag.Name
	pv.Changes = []tool.Change{{Field: "name", Before: text(tag.Name), After: text(name)}}

	return func() (manageAccountsAndPayeesOut, error) {
		renamed, err := c.svc.RenameTag(ctx, c.booksID, tag.Name, name)
		return manageAccountsAndPayeesOut{Action: c.action, Name: renamed.Name}, err
	}, nil
}

func (c organizeCall) planMergeTag(ctx context.Context, pv *tool.Preview) (organizeRun, error) {
	text := tool.TextValue

	if err := c.check([]string{"tag", "into_tag"}); err != nil {
		return nil, err
	}

	from, err := c.svc.Tag(ctx, c.booksID, c.in.Tag)
	if err != nil {
		return nil, err
	}

	pv.Target, pv.Destructive = from.Name, true
	pv.Changes = []tool.Change{{Field: "tags", Before: text(from.Name), After: text(c.in.IntoTag)}}

	return func() (manageAccountsAndPayeesOut, error) {
		merged, err := c.svc.MergeTag(ctx, c.booksID, from.Name, c.in.IntoTag)
		return manageAccountsAndPayeesOut{Action: c.action, Name: merged.Name}, err
	}, nil
}

func (c organizeCall) planDeleteInstitution(ctx context.Context, pv *tool.Preview) (organizeRun, error) {
	if err := c.check([]string{"institution_id"}); err != nil {
		return nil, err
	}

	name, err := institutionName(ctx, c.svc, c.booksID, c.institutionID)
	if err != nil {
		return nil, err
	}

	pv.Target, pv.Destructive = name, true

	return func() (manageAccountsAndPayeesOut, error) {
		return manageAccountsAndPayeesOut{Action: c.action, Name: name}, c.svc.DeleteInstitution(ctx, c.booksID, c.institutionID)
	}, nil
}

func (c organizeCall) planDeleteTag(ctx context.Context, pv *tool.Preview) (organizeRun, error) {
	if err := c.check([]string{"tag"}); err != nil {
		return nil, err
	}

	tag, err := c.svc.Tag(ctx, c.booksID, c.in.Tag)
	if err != nil {
		return nil, err
	}

	pv.Target, pv.Destructive = tag.Name, true

	return func() (manageAccountsAndPayeesOut, error) {
		return manageAccountsAndPayeesOut{Action: c.action, Name: tag.Name}, c.svc.DeleteTag(ctx, c.booksID, tag.Name)
	}, nil
}

func (c organizeCall) planMergePayee(ctx context.Context, pv *tool.Preview) (organizeRun, error) {
	text := tool.TextValue

	if err := c.check([]string{"payee_id", "into_id"}); err != nil {
		return nil, err
	}

	from, err := payeeByID(ctx, c.svc, c.booksID, c.payeeID)
	if err != nil {
		return nil, err
	}

	into, err := payeeByID(ctx, c.svc, c.booksID, c.intoID)
	if err != nil {
		return nil, err
	}

	pv.Target, pv.Destructive = from.Name, true
	pv.Changes = []tool.Change{{Field: "payee", Before: text(from.Name), After: text(into.Name)}}

	return func() (manageAccountsAndPayeesOut, error) {
		merged, err := c.svc.MergePayees(ctx, c.booksID, from.ID, into.ID)
		return manageAccountsAndPayeesOut{Action: c.action, ID: merged.ID.String(), Name: merged.Name}, err
	}, nil
}

func (c organizeCall) check(required []string, optional ...string) error {
	return checkFields(c.action, c.given, required, optional...)
}
