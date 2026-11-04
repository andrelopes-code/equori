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

// maxPassphraseBytes bounds the passphrase part: 256 characters of up to 4 bytes.
const maxPassphraseBytes = 1024

// maxFlagBytes bounds a boolean multipart part.
const maxFlagBytes = 16

// errFileRequired: the multipart body holds no part named file.
var errFileRequired = errors.New("file is required")

func toExport(e app.Export) Export {
	out := Export{Id: e.ID, Status: ExportStatus(e.Status), RequestedAt: e.RequestedAt, FinishedAt: e.FinishedAt}
	if e.Status == app.ExportReady {
		sum := hex.EncodeToString(e.SHA256)
		out.Size, out.Sha256, out.ArchiveVersion = &e.Size, &sum, &e.ArchiveVersion
	}

	if e.Problem != "" {
		out.Problem = &e.Problem
	}

	return out
}

func (s *Server) RequestExport(ctx context.Context, req RequestExportRequestObject) (RequestExportResponseObject, error) {
	passphrase := ""
	if req.Body != nil && req.Body.CredentialsPassphrase != nil {
		passphrase = *req.Body.CredentialsPassphrase
	}

	// Credentials leave the book only through its owner (export design C1).
	if passphrase != "" && !auth.MustBookRole(ctx).Allows(auth.RoleOwner) {
		return nil, app.ErrCredentialsRole
	}

	e, err := s.exports.Request(ctx, auth.MustBooksID(ctx), passphrase)
	if err != nil {
		return nil, err
	}

	return RequestExport202JSONResponse(toExport(e)), nil
}

func (s *Server) GetExport(ctx context.Context, _ GetExportRequestObject) (GetExportResponseObject, error) {
	e, err := s.exports.Get(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return nil, err
	}

	return GetExport200JSONResponse(toExport(e)), nil
}

func (s *Server) GetExportContent(ctx context.Context, _ GetExportContentRequestObject) (GetExportContentResponseObject, error) {
	content, requested, err := s.exports.Content(ctx, auth.MustBooksID(ctx))
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
	var (
		archive []byte
		creds   app.ImportCredentials
		found   bool
	)

	for {
		part, err := req.Body.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}

		if err != nil {
			return nil, fmt.Errorf("%w: %w", app.ErrArchiveInvalid, err)
		}

		switch part.FormName() {
		case "file":
			if found {
				continue
			}

			if archive, err = io.ReadAll(io.LimitReader(part, app.MaxArchiveBytes+1)); err != nil {
				return nil, fmt.Errorf("%w: %w", app.ErrArchiveInvalid, err)
			}

			found = true
		case "passphrase":
			b, err := io.ReadAll(io.LimitReader(part, maxPassphraseBytes))
			if err != nil {
				return nil, fmt.Errorf("%w: %w", app.ErrArchiveInvalid, err)
			}

			creds.Passphrase = string(b)
		case "skip_credentials":
			b, err := io.ReadAll(io.LimitReader(part, maxFlagBytes))
			if err != nil {
				return nil, fmt.Errorf("%w: %w", app.ErrArchiveInvalid, err)
			}

			creds.Skip = string(b) == "true"
		}
	}

	if !found {
		return nil, errFileRequired
	}

	res, err := s.exports.Import(ctx, auth.MustBooksID(ctx), archive, creds)
	if err != nil {
		return nil, err
	}

	counts := res.Tables

	out := ImportArchive200JSONResponse{
		ArchiveVersion:       res.ArchiveVersion,
		CredentialsInArchive: res.CredentialsInArchive,
		CredentialsRestored:  res.CredentialsRestored,
	}

	out.Tables = make([]struct {
		Name string `json:"name"`
		Rows int    `json:"rows"`
	}, len(counts))

	for i, c := range counts {
		out.Tables[i].Name, out.Tables[i].Rows = c.Name, c.Rows
	}

	return out, nil
}
