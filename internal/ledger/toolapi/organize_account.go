package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func (c organizeCall) planCreateAccount(
	ctx context.Context,
	pv *tool.Preview,
) (organizeRun, error) {
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
		"opened_on",
		"yield_mode",
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
		Name:          c.in.Name,
		Class:         domain.Class(c.in.Class),
		Kind:          domain.Kind(c.in.Kind),
		Instrument:    currency,
		ParentID:      c.parentID,
		InstitutionID: c.institutionID,
		OpenedOn:      c.in.OpenedOn.Time,
		YieldMode:     domain.YieldMode(c.in.YieldMode),
	}
	pv.Target = c.in.Name

	if err := c.describeNewAccount(ctx, pv, currency); err != nil {
		return nil, err
	}

	return func() (manageAccountsAndPayeesOut, error) {
		created, err := c.svc.CreateAccount(ctx, c.booksID, a)
		return manageAccountsAndPayeesOut{
			Action: c.action,
			ID:     created.ID.String(),
			Name:   created.Name,
		}, err
	}, nil
}

func (c organizeCall) describeNewAccount(
	ctx context.Context,
	pv *tool.Preview,
	currency money.Currency,
) error {
	text := tool.TextValue

	pv.Changes = []tool.Change{
		{Field: "name", After: text(c.in.Name)},
		{Field: "class", After: text(string(c.in.Class))},
	}
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

	if !c.in.OpenedOn.IsZero() {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "date", After: tool.DateValue(c.in.OpenedOn.Time)},
		)
	}

	if c.in.YieldMode != "" {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "status", After: text("yield " + string(c.in.YieldMode))},
		)
	}

	return nil
}

func (c organizeCall) planUpdateAccount(
	ctx context.Context,
	pv *tool.Preview,
) (organizeRun, error) {
	text := tool.TextValue

	if err := c.check(
		[]string{"account_id"},
		"name",
		"parent_id",
		"institution_id",
		"opened_on",
		"yield_mode",
		"excluded_from_liquidity",
	); err != nil {
		return nil, err
	}

	if c.in.Name == "" && c.parentID == uuid.Nil && c.institutionID == uuid.Nil &&
		!c.settingsGiven() {
		return nil, tool.InvalidArgument(
			"name",
			"one of name, parent_id, institution_id, opened_on, yield_mode or excluded_from_liquidity is required for update_account",
		)
	}

	a, err := c.svc.Account(ctx, c.booksID, c.accountID)
	if err != nil {
		return nil, err
	}

	pv.Target = a.Name

	var patch app.AccountPatch
	if c.in.Name != "" {
		patch.Name = &c.in.Name
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "name", Before: text(a.Name), After: text(c.in.Name)},
		)
	}

	if err := c.patchParent(ctx, pv, &patch, a.ParentID); err != nil {
		return nil, err
	}

	if err := c.patchInstitution(ctx, pv, &patch, a.InstitutionID); err != nil {
		return nil, err
	}

	c.patchSettings(pv, &patch, a)

	return func() (manageAccountsAndPayeesOut, error) {
		updated, err := c.svc.UpdateAccount(ctx, c.booksID, a.ID, patch)
		return manageAccountsAndPayeesOut{
			Action: c.action,
			ID:     a.ID.String(),
			Name:   updated.Name,
		}, err
	}, nil
}

func (c organizeCall) settingsGiven() bool {
	return c.given["opened_on"] || c.given["yield_mode"] || c.given["excluded_from_liquidity"]
}

// patchSettings sets the opening date, the yield mode and the liquidity flag that the call gave.
func (c organizeCall) patchSettings(pv *tool.Preview, patch *app.AccountPatch, a domain.Account) {
	text := tool.TextValue

	if !c.in.OpenedOn.IsZero() {
		patch.OpenedOn = &c.in.OpenedOn.Time
		pv.Changes = append(
			pv.Changes,
			tool.Change{
				Field:  "date",
				Before: tool.DateValue(a.OpenedOn),
				After:  tool.DateValue(c.in.OpenedOn.Time),
			},
		)
	}

	if c.in.YieldMode != "" {
		mode := domain.YieldMode(c.in.YieldMode)
		patch.YieldMode = &mode
		pv.Changes = append(
			pv.Changes,
			tool.Change{
				Field:  "status",
				Before: text("yield " + string(a.YieldMode)),
				After:  text("yield " + string(mode)),
			},
		)
	}

	if c.in.ExcludedFromLiquidity.Set {
		patch.ExcludedFromLiquidity = &c.in.ExcludedFromLiquidity.B
		pv.Changes = append(
			pv.Changes,
			tool.Change{
				Field:  "status",
				Before: text(liquidityText(a.ExcludedFromLiquidity)),
				After:  text(liquidityText(c.in.ExcludedFromLiquidity.B)),
			},
		)
	}
}

func liquidityText(excluded bool) string {
	if excluded {
		return "excluded from liquidity"
	}

	return "counts in liquidity"
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

	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "parent", Before: text(before), After: text(after)},
	)

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

	pv.Changes = append(
		pv.Changes,
		tool.Change{Field: "institution", Before: text(before), After: text(after)},
	)

	return nil
}

func (c organizeCall) planCloseOrReopenAccount(
	ctx context.Context,
	pv *tool.Preview,
) (organizeRun, error) {
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
		pv.Changes = []tool.Change{
			{Field: "status", Before: text("active"), After: text("closed")},
			{Field: "date", After: tool.DateValue(date)},
		}
	} else {
		pv.Changes = []tool.Change{{Field: "status", Before: text("closed"), After: text("active")}}
	}

	return func() (manageAccountsAndPayeesOut, error) {
		if closing {
			return manageAccountsAndPayeesOut{
				Action: c.action,
				ID:     a.ID.String(),
				Name:   a.Name,
			}, c.svc.CloseAccount(
				ctx,
				c.booksID,
				a.ID,
				date,
			)
		}

		_, err := c.svc.ReopenAccount(ctx, c.booksID, a.ID)

		return manageAccountsAndPayeesOut{Action: c.action, ID: a.ID.String(), Name: a.Name}, err
	}, nil
}

func (c organizeCall) planMergeCategory(
	ctx context.Context,
	pv *tool.Preview,
) (organizeRun, error) {
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
		return manageAccountsAndPayeesOut{
			Action: c.action,
			ID:     merged.ID.String(),
			Name:   merged.Name,
		}, err
	}, nil
}
