package httpapi

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/reporting/app"
)

// maxPassphraseBytes bounds the passphrase part: 256 characters of up to 4 bytes.
const maxPassphraseBytes = 1024

// maxFlagBytes bounds a boolean multipart part.
const maxFlagBytes = 16

// maxNameBytes bounds the replace_books_name part.
const maxNameBytes = 1024

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

// requestExport is a custom handler: the body is optional and the success status is 202.
func (s *Server) requestExport(w http.ResponseWriter, r *http.Request) {
	var body ExportRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		s.errs.WriteRequestError(w, r, fmt.Errorf("can't decode JSON body: %w", err))

		return
	}

	ctx := r.Context()

	passphrase := ""
	if body.CredentialsPassphrase != nil {
		passphrase = *body.CredentialsPassphrase
	}

	// Credentials leave the book only through its owner (export design C1).
	if passphrase != "" && !auth.MustBookRole(ctx).Allows(auth.RoleOwner) {
		s.errs.Write(w, r, app.ErrCredentialsRole)

		return
	}

	e, err := s.exports.Request(ctx, auth.MustBooksID(ctx), passphrase)
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	s.writeJSON(w, r, http.StatusAccepted, toExport(e))
}

func (s *Server) getExport(
	ctx context.Context,
	_ *http.Request,
	_ httpserver.None,
) (Export, error) {
	e, err := s.exports.Get(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return Export{}, err
	}

	return toExport(e), nil
}

// getExportContent is a custom handler: the response is a ZIP with Content-Disposition.
func (s *Server) getExportContent(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	content, requested, err := s.exports.Content(ctx, auth.MustBooksID(ctx))
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	w.Header().Set("Content-Type", "application/zip")

	if len(content) != 0 {
		w.Header().Set("Content-Length", strconv.Itoa(len(content)))
	}

	w.Header().Set(
		"Content-Disposition",
		`attachment; filename="equori-export-`+requested.Format(time.DateOnly)+`.zip"`,
	)
	w.WriteHeader(http.StatusOK)
	_, _ = bytes.NewReader(content).WriteTo(w)
}

// importArchive is a custom handler: the request body is multipart.
func (s *Server) importArchive(w http.ResponseWriter, r *http.Request) {
	reader, err := r.MultipartReader()
	if err != nil {
		s.errs.WriteRequestError(w, r, fmt.Errorf("can't decode multipart body: %w", err))

		return
	}

	out, err := s.restoreArchive(r.Context(), reader)
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	s.writeJSON(w, r, http.StatusOK, out)
}

func (s *Server) writeJSON(w http.ResponseWriter, r *http.Request, status int, v any) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(v); err != nil {
		s.errs.Write(w, r, err)

		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = buf.WriteTo(w)
}

func (s *Server) restoreArchive(ctx context.Context, body *multipart.Reader) (ArchiveImport, error) {
	var (
		archive []byte
		creds   app.ImportCredentials
		replace string
		found   bool
	)

	for {
		part, err := body.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}

		if err != nil {
			return ArchiveImport{}, fmt.Errorf("%w: %w", app.ErrArchiveInvalid, err)
		}

		switch part.FormName() {
		case "file":
			if found {
				continue
			}

			if archive, err = io.ReadAll(io.LimitReader(part, app.MaxArchiveBytes+1)); err != nil {
				return ArchiveImport{}, fmt.Errorf("%w: %w", app.ErrArchiveInvalid, err)
			}

			found = true
		case "passphrase":
			b, err := io.ReadAll(io.LimitReader(part, maxPassphraseBytes))
			if err != nil {
				return ArchiveImport{}, fmt.Errorf("%w: %w", app.ErrArchiveInvalid, err)
			}

			creds.Passphrase = string(b)
		case "skip_credentials":
			b, err := io.ReadAll(io.LimitReader(part, maxFlagBytes))
			if err != nil {
				return ArchiveImport{}, fmt.Errorf("%w: %w", app.ErrArchiveInvalid, err)
			}

			creds.Skip = string(b) == "true"
		case "replace_books_name":
			b, err := io.ReadAll(io.LimitReader(part, maxNameBytes))
			if err != nil {
				return ArchiveImport{}, fmt.Errorf("%w: %w", app.ErrArchiveInvalid, err)
			}

			replace = string(b)
		}
	}

	if !found {
		return ArchiveImport{}, errFileRequired
	}

	res, err := s.exports.Import(ctx, auth.MustBooksID(ctx), archive, creds, replace)
	if err != nil {
		return ArchiveImport{}, err
	}

	counts := res.Tables

	out := ArchiveImport{
		ArchiveVersion:       res.ArchiveVersion,
		CredentialsInArchive: res.CredentialsInArchive,
		CredentialsRestored:  res.CredentialsRestored,
		ProviderKeysRestored: res.ProviderKeysRestored,
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
