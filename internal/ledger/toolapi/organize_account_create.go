package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func (c organizeCall) planCreateAccount(
	ctx context.Context,
	pv *tool.Preview,
) (organizeRun, error) {
	if err := c.checkCreateFields(); err != nil {
		return nil, err
	}

	color, icon, err := c.appearance()
	if err != nil {
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
	setAppearance(&a, color, icon)

	pv.Target = c.in.Name

	if err := c.describeNewAccount(ctx, pv, currency); err != nil {
		return nil, err
	}

	pv.Changes = append(pv.Changes, newAppearanceChanges(color, icon)...)

	return func() (manageAccountsAndPayeesOut, error) {
		created, err := c.svc.CreateAccount(ctx, c.booksID, a)

		return manageAccountsAndPayeesOut{
			Action: c.action,
			ID:     created.ID.String(),
			Name:   created.Name,
		}, err
	}, nil
}

func (c organizeCall) checkCreateFields() error {
	required := []string{"name", "class"}
	if c.in.Class == "asset" || c.in.Class == "liability" {
		required = append(required, "kind")
	}

	return c.check(
		required,
		"kind",
		"currency",
		"parent_id",
		"institution_id",
		"opened_on",
		"yield_mode",
		"color",
		"icon",
	)
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
