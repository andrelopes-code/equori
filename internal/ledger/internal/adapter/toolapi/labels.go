package toolapi

import (
	"context"
	"strings"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
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
		Description: "Lists the user's payees, the tags in use or the institutions, by name, with IDs. " +
			"Use it to find the payee_id a write takes or to check whether a payee, tag or institution exists. " +
			"Do not use it for transactions of a payee: search_transactions with query does that.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, userID int64, in listPayeesAndTagsIn) (listPayeesAndTagsOut, error) {
		q := strings.ToLower(in.Query)
		match := func(name string) bool { return strings.Contains(strings.ToLower(name), q) }
		var out listPayeesAndTagsOut
		var err error
		switch in.Kind {
		case "payees":
			var rows []app.Payee
			if rows, err = allPages(func(p page.Request[app.PayeeKey]) ([]app.Payee, *app.PayeeKey, error) {
				return svc.ListPayees(ctx, userID, p)
			}); err != nil {
				return out, err
			}
			views := []payeeView{}
			for _, r := range rows {
				if match(r.Name) {
					views = append(views, payeeView{PayeeID: r.ID.String(), Name: r.Name})
				}
			}
			out.Payees, out.NextCursor, err = tool.PageOf(views, func(v payeeView) string { return v.PayeeID }, in.PageArgs)
		case "tags":
			var rows []string
			if rows, err = allPages(func(p page.Request[app.TagKey]) ([]string, *app.TagKey, error) {
				return svc.ListTags(ctx, userID, p)
			}); err != nil {
				return out, err
			}
			tags := []string{}
			for _, r := range rows {
				if match(r) {
					tags = append(tags, r)
				}
			}
			out.Tags, out.NextCursor, err = tool.PageOf(tags, func(s string) string { return s }, in.PageArgs)
		default:
			var rows []app.Institution
			if rows, err = allPages(func(p page.Request[app.InstitutionKey]) ([]app.Institution, *app.InstitutionKey, error) {
				return svc.ListInstitutions(ctx, userID, p)
			}); err != nil {
				return out, err
			}
			views := []institutionView{}
			for _, r := range rows {
				if match(r.Name) {
					views = append(views, institutionView{InstitutionID: r.ID.String(), Name: r.Name})
				}
			}
			out.Institutions, out.NextCursor, err = tool.PageOf(views, func(v institutionView) string { return v.InstitutionID }, in.PageArgs)
		}
		return out, err
	})
}
