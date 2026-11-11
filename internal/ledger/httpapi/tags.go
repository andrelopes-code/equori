package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (s *Server) listTags(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (TagList, error) {
	params, err := httpserver.Query[ListTagsParams](r)
	if err != nil {
		return TagList{}, err
	}

	p, err := listPage[app.TagKey](params.Limit, params.Cursor)
	if err != nil {
		return TagList{}, err
	}

	tags, next, err := s.svc.ListTags(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return TagList{}, err
	}

	out := TagList{Items: append([]string{}, tags...)}
	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) getTag(ctx context.Context, r *http.Request, _ httpserver.None) (TagUsage, error) {
	name := r.PathValue("name")

	t, err := s.svc.Tag(ctx, auth.MustBooksID(ctx), name)
	if err != nil {
		return TagUsage{}, err
	}

	return toTagUsageAPI(t), nil
}

func (s *Server) renameTag(
	ctx context.Context,
	r *http.Request,
	in RenameTagJSONRequestBody,
) (TagUsage, error) {
	name := r.PathValue("name")

	t, err := s.svc.RenameTag(ctx, auth.MustBooksID(ctx), name, in.Name)
	if err != nil {
		return TagUsage{}, err
	}

	return toTagUsageAPI(t), nil
}

func (s *Server) mergeTag(
	ctx context.Context,
	r *http.Request,
	in MergeTagJSONRequestBody,
) (TagUsage, error) {
	name := r.PathValue("name")

	t, err := s.svc.MergeTag(ctx, auth.MustBooksID(ctx), name, in.Into)
	if err != nil {
		return TagUsage{}, err
	}

	return toTagUsageAPI(t), nil
}

func (s *Server) deleteTag(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	name := r.PathValue("name")

	if err := s.svc.DeleteTag(ctx, auth.MustBooksID(ctx), name); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}

func toTagUsageAPI(t app.TagUsage) TagUsage {
	return TagUsage{Name: t.Name, Transactions: t.Transactions}
}
