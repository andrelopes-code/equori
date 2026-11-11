package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func (s *Server) ListTags(ctx context.Context, req ListTagsRequestObject) (ListTagsResponseObject, error) {
	p, err := listPage[app.TagKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}

	tags, next, err := s.svc.ListTags(ctx, auth.MustBooksID(ctx), p)
	if err != nil {
		return nil, err
	}

	out := ListTags200JSONResponse{Items: append([]string{}, tags...)}
	out.NextCursor, err = page.Next(next)

	return out, err
}

func (s *Server) GetTag(ctx context.Context, req GetTagRequestObject) (GetTagResponseObject, error) {
	t, err := s.svc.Tag(ctx, auth.MustBooksID(ctx), req.Name)
	if err != nil {
		return nil, err
	}

	return GetTag200JSONResponse(toTagUsageAPI(t)), nil
}

func (s *Server) RenameTag(ctx context.Context, req RenameTagRequestObject) (RenameTagResponseObject, error) {
	t, err := s.svc.RenameTag(ctx, auth.MustBooksID(ctx), req.Name, req.Body.Name)
	if err != nil {
		return nil, err
	}

	return RenameTag200JSONResponse(toTagUsageAPI(t)), nil
}

func (s *Server) MergeTag(ctx context.Context, req MergeTagRequestObject) (MergeTagResponseObject, error) {
	t, err := s.svc.MergeTag(ctx, auth.MustBooksID(ctx), req.Name, req.Body.Into)
	if err != nil {
		return nil, err
	}

	return MergeTag200JSONResponse(toTagUsageAPI(t)), nil
}

func (s *Server) DeleteTag(ctx context.Context, req DeleteTagRequestObject) (DeleteTagResponseObject, error) {
	if err := s.svc.DeleteTag(ctx, auth.MustBooksID(ctx), req.Name); err != nil {
		return nil, err
	}

	return DeleteTag204Response{}, nil
}

func toTagUsageAPI(t app.TagUsage) TagUsage {
	return TagUsage{Name: t.Name, Transactions: t.Transactions}
}
