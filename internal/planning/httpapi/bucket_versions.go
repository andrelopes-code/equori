package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) getBudgetBucketVersions(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (BudgetBucketVersions, error) {
	versions, err := s.svc.BucketVersions(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return BudgetBucketVersions{}, err
	}

	out := BudgetBucketVersions{Versions: make([]BudgetBucketVersion, len(versions))}
	for i, v := range versions {
		out.Versions[i] = toBucketVersionAPI(v)
	}

	return out, nil
}

func (s *Server) deleteBudgetBucketVersion(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	from, err := parseMonth("from", r.PathValue("from"))
	if err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, s.svc.DeleteBucketVersion(ctx, auth.MustBooksID(ctx), from)
}
