package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

func (s *Server) realizeOccurrence(
	ctx context.Context,
	r *http.Request,
	in RealizeOccurrenceJSONRequestBody,
) (Occurrence, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Occurrence{}, err
	}

	o, err := s.svc.Realize(ctx, auth.MustBooksID(ctx), id, in.TransactionId)
	if err != nil {
		return Occurrence{}, err
	}

	return toOccurrenceAPI(o), nil
}

func (s *Server) reopenOccurrence(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (Occurrence, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Occurrence{}, err
	}

	o, err := s.svc.Reopen(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return Occurrence{}, err
	}

	return toOccurrenceAPI(o), nil
}

func (s *Server) unrealizeOccurrence(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (Occurrence, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Occurrence{}, err
	}

	o, err := s.svc.Unrealize(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return Occurrence{}, err
	}

	return toOccurrenceAPI(o), nil
}
