package httpapi

import (
	"bytes"
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

// errFileRequired: the multipart body holds no part named file.
var errFileRequired = errors.New("file is required")

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

func (s *Server) ImportArchive(ctx context.Context, req ImportArchiveRequestObject) (ImportArchiveResponseObject, error) {
	var archive []byte
	for {
		part, err := req.Body.NextPart()
		if errors.Is(err, io.EOF) {
			return nil, errFileRequired
		}
		if err != nil {
			return nil, fmt.Errorf("%w: %w", app.ErrArchiveInvalid, err)
		}
		if part.FormName() != "file" {
			continue
		}
		if archive, err = io.ReadAll(io.LimitReader(part, app.MaxArchiveBytes+1)); err != nil {
			return nil, fmt.Errorf("%w: %w", app.ErrArchiveInvalid, err)
		}
		break
	}
	counts, err := s.exports.Import(ctx, auth.MustUserID(ctx), archive)
	if err != nil {
		return nil, err
	}
	out := ImportArchive200JSONResponse{Tables: make([]struct {
		Name string `json:"name"`
		Rows int    `json:"rows"`
	}, len(counts))}
	for i, c := range counts {
		out.Tables[i].Name, out.Tables[i].Rows = c.Name, c.Rows
	}
	return out, nil
}
