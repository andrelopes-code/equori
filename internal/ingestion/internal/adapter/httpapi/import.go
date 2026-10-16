package httpapi

import (
	"context"
	"errors"
	"io"
	"mime/multipart"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/app"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
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

func (s *Server) ImportFile(ctx context.Context, req ImportFileRequestObject) (ImportFileResponseObject, error) {
	format, name, content, err := readForm(req.Body)
	if err != nil {
		return nil, err
	}
	b, err := s.svc.Import(ctx, app.ImportFile{
		UserID: auth.MustUserID(ctx), AccountID: req.Id, Source: domain.Source(format), FileName: name, Content: content,
	})
	if err != nil {
		return nil, err
	}
	location := BaseURL + "/import-batches/" + b.ID.String()
	return ImportFile201JSONResponse{Body: toBatchAPI(b), Headers: ImportFile201ResponseHeaders{Location: &location}}, nil
}

func (s *Server) GetImportBatch(ctx context.Context, req GetImportBatchRequestObject) (GetImportBatchResponseObject, error) {
	b, err := s.svc.Batch(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	return GetImportBatch200JSONResponse(toBatchAPI(b)), nil
}
