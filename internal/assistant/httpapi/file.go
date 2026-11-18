package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/problem"
)

// fileForm is the multipart body of createAssistantFile.
type fileForm struct {
	conversation uuid.UUID
	name         string
	content      []byte
}

// createAssistantFile is a custom handler: the request body is multipart.
func (s *Server) createAssistantFile(w http.ResponseWriter, r *http.Request) {
	reader, err := r.MultipartReader()
	if err != nil {
		s.errs.WriteRequestError(w, r, fmt.Errorf("can't decode multipart body: %w", err))

		return
	}

	form, err := readFileForm(reader)
	if _, ok := errors.AsType[*domain.FieldError](err); ok {
		s.errs.Write(w, r, err)

		return
	}

	if err != nil {
		s.errs.WriteRequestError(w, r, err)

		return
	}

	ctx := r.Context()

	f, err := s.svc.CreateFile(
		ctx,
		auth.MustBooksID(ctx),
		auth.MustMemberID(ctx),
		form.conversation,
		form.name,
		form.content,
	)
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(toFileAPI(f)); err != nil {
		s.errs.Write(w, r, err)

		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_, _ = buf.WriteTo(w)
}

func (s *Server) deleteAssistantFile(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	err = s.svc.DeleteFile(ctx, auth.MustBooksID(ctx), auth.MustMemberID(ctx), id)

	return httpserver.None{}, err
}

// readFileForm reads the parts "file" and "conversation_id", reading at most one byte past the
// file limit so the service refuses an oversized file without buffering the rest of it.
func readFileForm(body *multipart.Reader) (fileForm, error) {
	var form fileForm

	found := false

	for {
		part, err := body.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}

		if err != nil {
			return fileForm{}, fmt.Errorf("read multipart part: %w", err)
		}

		switch part.FormName() {
		case "file":
			form.name = part.FileName()
			form.content, err = io.ReadAll(io.LimitReader(part, domain.MaxFileBytes+1))
			found = true
		case "conversation_id":
			form.conversation, err = readConversationID(part)
		}

		if err != nil {
			return fileForm{}, err
		}
	}

	if !found {
		return fileForm{}, &domain.FieldError{Field: "file", Message: "is required"}
	}

	return form, nil
}

func readConversationID(part *multipart.Part) (uuid.UUID, error) {
	b, err := io.ReadAll(io.LimitReader(part, 64))
	if err != nil {
		return uuid.Nil, fmt.Errorf("read conversation_id: %w", err)
	}

	id, err := uuid.Parse(string(b))
	if err != nil {
		return uuid.Nil, &domain.FieldError{Field: "conversation_id", Message: "is not a UUID"}
	}

	return id, nil
}

func toFileAPI(f domain.File) AssistantFile {
	out := AssistantFile{
		Id:        f.ID,
		Name:      f.Name,
		Kind:      AssistantFileKind(f.Kind),
		Size:      f.Size,
		CreatedAt: f.CreatedAt,
	}
	if f.ConversationID != uuid.Nil {
		out.ConversationId = &f.ConversationID
	}

	return out
}

// fileProblem maps the errors of a conversation file to the codes of createAssistantFile and
// deleteAssistantFile.
func fileProblem(err error) (problem.Details, bool) {
	switch {
	case errors.Is(err, domain.ErrFileKindUnsupported):
		return problem.New(
			http.StatusUnsupportedMediaType,
			"file_kind_unsupported",
			"the file is not an OFX, CSV, PDF, JPEG, PNG, WebP or text file",
		), true
	case errors.Is(err, domain.ErrFileTooLarge):
		return problem.New(
			http.StatusRequestEntityTooLarge,
			"file_too_large",
			"a file holds at most 10 MiB",
		), true
	case errors.Is(err, domain.ErrConversationFilesFull):
		return problem.New(
			http.StatusConflict,
			"conversation_files_full",
			"the files of a conversation hold at most 50 MiB",
		), true
	case errors.Is(err, domain.ErrFileNotFound):
		return problem.New(http.StatusNotFound, "file_not_found", "file not found"), true
	}

	return problem.Details{}, false
}
