package httpapi

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"strconv"

	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
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
			return "", nil, &domain.FieldError{
				Field:   "file",
				Message: "is required",
				Err:     domain.ErrValidation,
			}
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

// createAttachment is a custom handler: the request body is multipart.
func (s *Server) createAttachment(w http.ResponseWriter, r *http.Request) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	reader, err := r.MultipartReader()
	if err != nil {
		s.errs.WriteRequestError(w, r, fmt.Errorf("can't decode multipart body: %w", err))

		return
	}

	name, content, err := readFile(reader)
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	ctx := r.Context()

	att, err := s.svc.Attach(
		ctx,
		auth.MustBooksID(ctx),
		id,
		name,
		http.DetectContentType(content),
		content,
	)
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(toAttachmentAPI(att)); err != nil {
		s.errs.Write(w, r, err)

		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_, _ = buf.WriteTo(w)
}

func (s *Server) listAttachments(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (AttachmentList, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return AttachmentList{}, err
	}

	params, err := httpserver.Query[ListAttachmentsParams](r)
	if err != nil {
		return AttachmentList{}, err
	}

	p, err := listPage[app.AttachmentKey](params.Limit, params.Cursor)
	if err != nil {
		return AttachmentList{}, err
	}

	as, next, err := s.svc.Attachments(ctx, auth.MustBooksID(ctx), id, p)
	if err != nil {
		return AttachmentList{}, err
	}

	out := AttachmentList{Items: make([]Attachment, len(as))}
	for i, a := range as {
		out.Items[i] = toAttachmentAPI(a)
	}

	out.NextCursor, err = page.Next(next)

	return out, err
}

// getAttachmentContent is a custom handler: the success body is the file, not JSON.
func (s *Server) getAttachmentContent(w http.ResponseWriter, r *http.Request) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	params, err := httpserver.Query[GetAttachmentContentParams](r)
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	ctx := r.Context()

	c, err := s.svc.AttachmentContent(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	kind, csp := "attachment", "default-src 'none'; frame-ancestors 'none'"
	if params.Disposition != nil &&
		*params.Disposition == GetAttachmentContentParamsDispositionInline {
		if !app.Inlineable(c.MediaType) {
			s.errs.Write(w, r, app.ErrNotInlineable)

			return
		}

		// A frame of the application shows the file, so only this response admits one (ADR 007, C9a).
		kind, csp = "inline", "default-src 'none'; frame-ancestors 'self'"
	}

	w.Header().Set("Content-Type", c.MediaType)

	if len(c.Content) != 0 {
		w.Header().Set("Content-Length", strconv.Itoa(len(c.Content)))
	}

	w.Header().
		Set("Content-Disposition", mime.FormatMediaType(kind, map[string]string{"filename": c.FileName}))
	w.Header().Set("Content-Security-Policy", csp)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(c.Content)
}

func (s *Server) deleteAttachment(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	if err := s.svc.DeleteAttachment(ctx, auth.MustBooksID(ctx), id); err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, nil
}
