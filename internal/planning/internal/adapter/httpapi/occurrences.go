package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func (s *Server) RealizeOccurrence(ctx context.Context, req RealizeOccurrenceRequestObject) (RealizeOccurrenceResponseObject, error) {
	o, err := s.svc.Realize(ctx, auth.MustUserID(ctx), req.Id, req.Body.TransactionId)
	if err != nil {
		return nil, err
	}
	return RealizeOccurrence200JSONResponse(toOccurrenceAPI(o)), nil
}

func (s *Server) UnrealizeOccurrence(ctx context.Context, req UnrealizeOccurrenceRequestObject) (UnrealizeOccurrenceResponseObject, error) {
	o, err := s.svc.Unrealize(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	return UnrealizeOccurrence200JSONResponse(toOccurrenceAPI(o)), nil
}
