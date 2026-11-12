package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type manageAccountsAndPayeesAction string

func (manageAccountsAndPayeesAction) Values() []string {
	return []string{
		"create_account",
		"update_account",
		"close_account",
		"reopen_account",
		"merge_category",
		"create_payee",
		"rename_payee",
		"merge_payee",
		"create_institution",
		"delete_institution",
		"rename_tag",
		"merge_tag",
		"delete_tag",
	}
}

type manageAccountsAndPayeesClass string

func (manageAccountsAndPayeesClass) Values() []string {
	return []string{"asset", "liability", "equity", "income", "expense"}
}

type manageAccountsAndPayeesKind string

func (manageAccountsAndPayeesKind) Values() []string {
	return []string{
		"checking",
		"savings",
		"cash",
		"wallet",
		"benefit",
		"reserve",
		"brokerage",
		"receivable",
		"loan",
		"credit_card",
		"other",
	}
}

type manageAccountsAndPayeesYield string

func (manageAccountsAndPayeesYield) Values() []string { return []string{"none", "auto"} }

type manageAccountsAndPayeesIn struct {
	Action        manageAccountsAndPayeesAction `json:"action"                  jsonschema:"operation to propose"`
	AccountID     string                        `json:"account_id,omitzero"     jsonschema:"account or category to change or merge, from list_accounts"`
	Name          string                        `json:"name,omitzero"           jsonschema:"name of the new or renamed account, category, payee, institution or tag"`
	Class         manageAccountsAndPayeesClass  `json:"class,omitzero"          jsonschema:"for create_account: class of the new account; income and expense create categories"`
	Kind          manageAccountsAndPayeesKind   `json:"kind,omitzero"           jsonschema:"for create_account of an asset or liability: kind of account"`
	Currency      string                        `json:"currency,omitzero"       jsonschema:"for create_account: ISO currency code; the base currency when absent; never an Investment code, which the first buy creates"`
	ParentID      string                        `json:"parent_id,omitzero"      jsonschema:"for create_account and update_account: parent account or category"`
	InstitutionID string                        `json:"institution_id,omitzero" jsonschema:"for create_account, update_account and delete_institution: institution from list_payees_and_tags"`
	Date          tool.Date                     `json:"date,omitzero"           jsonschema:"for close_account: closing date; today when absent"`
	IntoID        string                        `json:"into_id,omitzero"        jsonschema:"for merge_category and merge_payee: category or payee that remains"`
	PayeeID       string                        `json:"payee_id,omitzero"       jsonschema:"for rename_payee and merge_payee: payee to change, from list_payees_and_tags"`
	Tag           string                        `json:"tag,omitzero"            jsonschema:"for rename_tag, merge_tag and delete_tag: tag to change, from list_payees_and_tags"`
	IntoTag       string                        `json:"into_tag,omitzero"       jsonschema:"for merge_tag: tag that remains"`

	OpenedOn              tool.Date                    `json:"opened_on,omitzero"               jsonschema:"for create_account: opening date; for update_account: an earlier opening date"`
	YieldMode             manageAccountsAndPayeesYield `json:"yield_mode,omitzero"              jsonschema:"for create_account and update_account: auto books the yield of the account"`
	ExcludedFromLiquidity tool.OptionalBool            `json:"excluded_from_liquidity,omitzero" jsonschema:"for update_account: leave the account out of the liquidity indicator"`
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
		"account_id":              in.AccountID != "",
		"name":                    in.Name != "",
		"class":                   in.Class != "",
		"kind":                    in.Kind != "",
		"currency":                in.Currency != "",
		"parent_id":               in.ParentID != "",
		"institution_id":          in.InstitutionID != "",
		"date":                    !in.Date.IsZero(),
		"into_id":                 in.IntoID != "",
		"payee_id":                in.PayeeID != "",
		"tag":                     in.Tag != "",
		"into_tag":                in.IntoTag != "",
		"opened_on":               !in.OpenedOn.IsZero(),
		"yield_mode":              in.YieldMode != "",
		"excluded_from_liquidity": in.ExcludedFromLiquidity.Set,
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

func (c organizeCall) check(required []string, optional ...string) error {
	return checkFields(c.action, c.given, required, optional...)
}

// checkFields requires the fields an action needs and rejects the ones it does not read.
func checkFields(
	action string,
	given map[string]bool,
	required []string,
	optional ...string,
) error {
	for _, f := range required {
		if !given[f] {
			return tool.InvalidArgument(f, "is required for "+action)
		}
	}

	return unusedFields(action, given, append(required, optional...)...)
}

func institutionName(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	id uuid.UUID,
) (string, error) {
	all, err := allPages(
		func(p page.Request[app.InstitutionKey]) ([]app.Institution, *app.InstitutionKey, error) {
			return svc.ListInstitutions(ctx, booksID, p)
		},
	)
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

func payeeByID(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	id uuid.UUID,
) (app.Payee, error) {
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
func accountName(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	id uuid.UUID,
) (string, error) {
	if id == uuid.Nil {
		return "", nil
	}

	a, err := svc.Account(ctx, booksID, id)

	return a.Name, err
}
