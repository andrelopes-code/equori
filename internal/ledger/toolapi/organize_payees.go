package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func (c organizeCall) planCreatePayeeOrInstitution(
	ctx context.Context,
	pv *tool.Preview,
) (organizeRun, error) {
	text := tool.TextValue

	var optional []string
	if c.in.Action == "create_institution" {
		optional = []string{"scheme", "identifier"}
	}

	if err := c.check([]string{"name"}, optional...); err != nil {
		return nil, err
	}

	ident, err := c.institutionIdentifier()
	if err != nil {
		return nil, err
	}

	pv.Target = c.in.Name
	pv.Changes = []tool.Change{{Field: "name", After: text(c.in.Name)}}

	if ident != (app.InstitutionIdentifier{}) {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "identifier", After: text(identifierText(ident))},
		)
	}

	return func() (manageAccountsAndPayeesOut, error) {
		if c.in.Action == "create_payee" {
			p, err := c.svc.CreatePayee(ctx, c.booksID, c.in.Name)

			return manageAccountsAndPayeesOut{
				Action: c.action,
				ID:     p.ID.String(),
				Name:   p.Name,
			}, err
		}

		i, err := c.svc.CreateInstitution(
			ctx,
			c.booksID,
			app.Institution{Name: c.in.Name, Identifier: ident},
		)

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

		return manageAccountsAndPayeesOut{
			Action: c.action,
			ID:     p.ID.String(),
			Name:   renamed.Name,
		}, err
	}, nil
}

func (c organizeCall) planDeleteInstitution(
	ctx context.Context,
	pv *tool.Preview,
) (organizeRun, error) {
	if err := c.check([]string{"institution_id"}); err != nil {
		return nil, err
	}

	name, err := institutionName(ctx, c.svc, c.booksID, c.institutionID)
	if err != nil {
		return nil, err
	}

	pv.Target, pv.Destructive = name, true

	return func() (manageAccountsAndPayeesOut, error) {
		return manageAccountsAndPayeesOut{
			Action: c.action,
			Name:   name,
		}, c.svc.DeleteInstitution(
			ctx,
			c.booksID,
			c.institutionID,
		)
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

		return manageAccountsAndPayeesOut{
			Action: c.action,
			ID:     merged.ID.String(),
			Name:   merged.Name,
		}, err
	}, nil
}
