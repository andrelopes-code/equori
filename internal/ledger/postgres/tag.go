package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (r *Repository) TagUsage(
	ctx context.Context,
	booksID int64,
	name string,
) (app.TagUsage, error) {
	row, err := r.q.GetTagUsage(ctx, GetTagUsageParams{BooksID: booksID, Name: name})
	if err != nil {
		return app.TagUsage{}, notFound(err)
	}

	return app.TagUsage{ID: row.ID, Name: row.Name, Transactions: int(row.Transactions)}, nil
}

func (r *Repository) RenameTag(
	ctx context.Context,
	booksID int64,
	id uuid.UUID,
	name string,
) error {
	_, err := r.q.RenameTag(ctx, RenameTagParams{BooksID: booksID, ID: id, NewName: name})
	return duplicate(notFound(err), "name")
}

func (r *Repository) TransactionsWithTag(
	ctx context.Context,
	booksID int64,
	tagID uuid.UUID,
) ([]uuid.UUID, error) {
	return r.q.TransactionsWithTag(ctx, TransactionsWithTagParams{BooksID: booksID, TagID: tagID})
}

func (r *Repository) MoveTagLinks(ctx context.Context, booksID int64, from, into uuid.UUID) error {
	return r.q.MoveTagLinks(ctx, MoveTagLinksParams{BooksID: booksID, FromID: from, IntoID: into})
}

func (r *Repository) DeleteTag(ctx context.Context, booksID int64, id uuid.UUID) error {
	return r.q.DeleteTag(ctx, DeleteTagParams{BooksID: booksID, ID: id})
}

func (r *Repository) ListTags(
	ctx context.Context,
	booksID int64,
	p page.Request[app.TagKey],
) ([]string, *app.TagKey, error) {
	params := ListTagsParams{BooksID: booksID, RowLimit: rowLimit(p.Limit)}
	if p.After != nil {
		params.AfterName = &p.After.Name
	}

	rows, err := r.q.ListTags(ctx, params)
	if err != nil {
		return nil, nil, err
	}

	items, next := pageOf(
		rows,
		p.Limit,
		func(name string) string { return name },
		func(name string) app.TagKey { return app.TagKey{Name: name} },
	)

	return items, next, nil
}
