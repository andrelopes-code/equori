package httpapi

import (
	"bytes"
	"context"
	"encoding/hex"
	"errors"
	"io"
	"mime"
	"mime/multipart"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

func toAttachmentAPI(a app.Attachment) Attachment {
	return Attachment{
		Id: a.ID, TransactionId: a.TransactionID, FileName: a.FileName, MediaType: a.MediaType,
		Size: a.Size, Sha256: hex.EncodeToString(a.SHA256), CreatedAt: a.CreatedAt,
	}
}

// readFile returns the "file" part, reading at most one byte past the content limit so
// the service rejects an oversized file without buffering the rest of it.
func readFile(body *multipart.Reader) (string, []byte, error) {
	for {
		part, err := body.NextPart()
		if errors.Is(err, io.EOF) {
			return "", nil, &domain.FieldError{Field: "file", Message: "is required", Err: domain.ErrValidation}
		}
		if err != nil {
			return "", nil, errors.Join(errInvalidRequest, err)
		}
		if part.FormName() != "file" {
			continue
		}
		content, err := io.ReadAll(io.LimitReader(part, app.MaxAttachmentBytes+1))
		if err != nil {
			return "", nil, errors.Join(errInvalidRequest, err)
		}
		return part.FileName(), content, nil
	}
}

func (s *Server) CreateAttachment(ctx context.Context, req CreateAttachmentRequestObject) (CreateAttachmentResponseObject, error) {
	name, content, err := readFile(req.Body)
	if err != nil {
		return nil, err
	}
	a, err := s.svc.Attach(ctx, auth.MustUserID(ctx), req.Id, name, http.DetectContentType(content), content)
	if err != nil {
		return nil, err
	}
	return CreateAttachment201JSONResponse(toAttachmentAPI(a)), nil
}

func (s *Server) ListAttachments(ctx context.Context, req ListAttachmentsRequestObject) (ListAttachmentsResponseObject, error) {
	p, err := listPage[app.AttachmentKey](req.Params.Limit, req.Params.Cursor)
	if err != nil {
		return nil, err
	}
	as, next, err := s.svc.Attachments(ctx, auth.MustUserID(ctx), req.Id, p)
	if err != nil {
		return nil, err
	}
	out := AttachmentList{Items: make([]Attachment, len(as))}
	for i, a := range as {
		out.Items[i] = toAttachmentAPI(a)
	}
	out.NextCursor, err = page.Next(next)
	return ListAttachments200JSONResponse(out), err
}

func (s *Server) GetAttachmentContent(ctx context.Context, req GetAttachmentContentRequestObject) (GetAttachmentContentResponseObject, error) {
	c, err := s.svc.AttachmentContent(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	kind, csp := "attachment", "default-src 'none'; frame-ancestors 'none'"
	if req.Params.Disposition != nil && *req.Params.Disposition == GetAttachmentContentParamsDispositionInline {
		if !app.Inlineable(c.MediaType) {
			return nil, app.ErrNotInlineable
		}
		// A frame of the application shows the file, so only this response admits one (ADR 007, C9a).
		kind, csp = "inline", "default-src 'none'; frame-ancestors 'self'"
	}
	disposition := mime.FormatMediaType(kind, map[string]string{"filename": c.FileName})
	return GetAttachmentContent200AsteriskResponse{
		Body: bytes.NewReader(c.Content), ContentType: c.MediaType, ContentLength: int64(len(c.Content)),
		Headers: GetAttachmentContent200ResponseHeaders{ContentDisposition: &disposition, ContentSecurityPolicy: &csp},
	}, nil
}

func (s *Server) DeleteAttachment(ctx context.Context, req DeleteAttachmentRequestObject) (DeleteAttachmentResponseObject, error) {
	if err := s.svc.DeleteAttachment(ctx, auth.MustUserID(ctx), req.Id); err != nil {
		return nil, err
	}
	return DeleteAttachment204Response{}, nil
}
