package httpapi

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

// readForm returns the format field and the file part, reading at most one byte past the
// file limit so the service rejects an oversized file without buffering the rest.
func readForm(body *multipart.Reader) (format, name string, content []byte, err error) {
	var sawFile bool
	for {
		part, err := body.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}

		if err != nil {
			if _, ok := problem.Transport(err); ok {
				return "", "", nil, err
			}

			return "", "", nil, &paramError{field: "body", message: "is not a valid multipart form"}
		}

		switch part.FormName() {
		case "format":
			b, err := io.ReadAll(io.LimitReader(part, 16))
			if err != nil {
				return "", "", nil, err
			}

			format = string(b)
		case "file":
			if content, err = io.ReadAll(io.LimitReader(part, app.MaxFileBytes+1)); err != nil {
				return "", "", nil, err
			}

			name, sawFile = part.FileName(), true
		}
	}

	switch {
	case format == "":
		return "", "", nil, &domain.FieldError{Field: "format", Message: "is required"}
	case !sawFile:
		return "", "", nil, &domain.FieldError{Field: "file", Message: "is required"}
	}

	return format, name, content, nil
}

// importFile is a custom handler: the request body is multipart and the success status is 201
// with a Location header.
func (s *Server) importFile(w http.ResponseWriter, r *http.Request) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	body, err := r.MultipartReader()
	if err != nil {
		s.errs.WriteRequestError(w, r, fmt.Errorf("can't decode multipart body: %w", err))

		return
	}

	format, name, content, err := readForm(body)
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	ctx := r.Context()

	b, err := s.svc.Import(ctx, app.ImportFile{
		BooksID: auth.MustBooksID(
			ctx,
		),
		AccountID: id,
		Source:    domain.Source(format),
		FileName:  name,
		Content:   content,
	})
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	httpserver.WriteCreated(s.errs, w, r, BaseURL+"/import-batches/"+b.ID.String(), toBatchAPI(b))
}

func (s *Server) getImportBatch(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (ImportBatch, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return ImportBatch{}, err
	}

	b, err := s.svc.Batch(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return ImportBatch{}, err
	}

	return toBatchAPI(b), nil
}
