package toolapi

import (
	"context"
	"strings"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type listPayeesAndTagsKind string

func (listPayeesAndTagsKind) Values() []string {
	return []string{"payees", "tags", "institutions"}
}

type listPayeesAndTagsIn struct {
	Kind  listPayeesAndTagsKind `json:"kind" jsonschema:"what to list"`
	Query string                `json:"query,omitzero" jsonschema:"case-insensitive text the name must contain"`
	tool.PageArgs
}

type payeeView struct {
	PayeeID string `json:"payee_id"`
	Name    string `json:"name"`
}

type institutionView struct {
	InstitutionID string `json:"institution_id"`
	Name          string `json:"name"`
}

type listPayeesAndTagsOut struct {
	Payees       []payeeView       `json:"payees,omitzero"`
	Tags         []string          `json:"tags,omitzero"`
	Institutions []institutionView `json:"institutions,omitzero"`
	NextCursor   string            `json:"next_cursor,omitzero" jsonschema:"present when more items follow; pass it as cursor"`
}

func listPayeesAndTags(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "list_payees_and_tags",
		Description: "Lists the book's payees, the tags in use or the institutions, by name, with IDs. " +
			"Use it to find the payee_id a write takes or to check whether a payee, tag or institution exists. " +
			"Do not use it for transactions of a payee: search_transactions with query does that.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, booksID int64, in listPayeesAndTagsIn) (listPayeesAndTagsOut, error) {
		return runListPayeesAndTags(ctx, svc, booksID, in)
	})
}

func runListPayeesAndTags(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in listPayeesAndTagsIn,
) (listPayeesAndTagsOut, error) {
	q := strings.ToLower(in.Query)
	match := func(name string) bool { return strings.Contains(strings.ToLower(name), q) }
	var out listPayeesAndTagsOut

	var err error
	switch in.Kind {
	case "payees":
		err = listPayees(ctx, svc, booksID, in, match, &out)
	case "tags":
		err = listTags(ctx, svc, booksID, in, match, &out)
	default:
		err = listInstitutions(ctx, svc, booksID, in, match, &out)
	}

	return out, err
}

func listPayees(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in listPayeesAndTagsIn,
	match func(string) bool,
	out *listPayeesAndTagsOut,
) error {
	rows, err := allPages(func(p page.Request[app.PayeeKey]) ([]app.Payee, *app.PayeeKey, error) {
		return svc.ListPayees(ctx, booksID, p)
	})
	if err != nil {
		return err
	}

	out.Payees, out.NextCursor, err = pageMatched(rows, match, in.PageArgs,
		func(r app.Payee) (string, payeeView) {
			return r.Name, payeeView{PayeeID: r.ID.String(), Name: r.Name}
		},
		func(v payeeView) string { return v.PayeeID },
	)

	return err
}

func listTags(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in listPayeesAndTagsIn,
	match func(string) bool,
	out *listPayeesAndTagsOut,
) error {
	rows, err := allPages(func(p page.Request[app.TagKey]) ([]string, *app.TagKey, error) {
		return svc.ListTags(ctx, booksID, p)
	})
	if err != nil {
		return err
	}

	tags := []string{}
	for _, r := range rows {
		if match(r) {
			tags = append(tags, r)
		}
	}

	out.Tags, out.NextCursor, err = tool.PageOf(tags, func(s string) string { return s }, in.PageArgs)

	return err
}

func listInstitutions(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in listPayeesAndTagsIn,
	match func(string) bool,
	out *listPayeesAndTagsOut,
) error {
	rows, err := allPages(func(p page.Request[app.InstitutionKey]) ([]app.Institution, *app.InstitutionKey, error) {
		return svc.ListInstitutions(ctx, booksID, p)
	})
	if err != nil {
		return err
	}

	out.Institutions, out.NextCursor, err = pageMatched(rows, match, in.PageArgs,
		func(r app.Institution) (string, institutionView) {
			return r.Name, institutionView{InstitutionID: r.ID.String(), Name: r.Name}
		},
		func(v institutionView) string { return v.InstitutionID },
	)

	return err
}

// pageMatched keeps the views of the rows whose name satisfies match and returns one page of them.
func pageMatched[R, V any](
	rows []R,
	match func(string) bool,
	args tool.PageArgs,
	view func(R) (string, V),
	key func(V) string,
) ([]V, string, error) {
	views := []V{}
	for _, r := range rows {
		if name, v := view(r); match(name) {
			views = append(views, v)
		}
	}

	return tool.PageOf(views, key, args)
}
