package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

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
		return manageAccountsAndPayeesOut{
			Action: c.action,
			Name:   tag.Name,
		}, c.svc.DeleteTag(
			ctx,
			c.booksID,
			tag.Name,
		)
	}, nil
}
