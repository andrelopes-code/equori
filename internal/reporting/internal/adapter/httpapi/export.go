package httpapi

import (
	"bytes"
	"context"
	"encoding/hex"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

func toExport(e app.Export) Export {
	out := Export{Id: e.ID, Status: ExportStatus(e.Status), RequestedAt: e.RequestedAt, FinishedAt: e.FinishedAt}
	if e.Status == app.ExportReady {
		sum := hex.EncodeToString(e.SHA256)
		out.Size, out.Sha256 = &e.Size, &sum
	}
	if e.Problem != "" {
		out.Problem = &e.Problem
	}
	return out
}

func (s *Server) RequestExport(ctx context.Context, _ RequestExportRequestObject) (RequestExportResponseObject, error) {
	e, err := s.exports.Request(ctx, auth.MustUserID(ctx))
	if err != nil {
		return nil, err
	}
	return RequestExport202JSONResponse(toExport(e)), nil
}

func (s *Server) GetExport(ctx context.Context, _ GetExportRequestObject) (GetExportResponseObject, error) {
	e, err := s.exports.Get(ctx, auth.MustUserID(ctx))
	if err != nil {
		return nil, err
	}
	return GetExport200JSONResponse(toExport(e)), nil
}

func (s *Server) GetExportContent(ctx context.Context, _ GetExportContentRequestObject) (GetExportContentResponseObject, error) {
	content, requested, err := s.exports.Content(ctx, auth.MustUserID(ctx))
	if err != nil {
		return nil, err
	}
	disposition := `attachment; filename="equori-export-` + requested.Format(time.DateOnly) + `.zip"`
	return GetExportContent200ApplicationzipResponse{
		Body: bytes.NewReader(content), ContentLength: int64(len(content)),
		Headers: GetExportContent200ResponseHeaders{ContentDisposition: &disposition},
	}, nil
}
