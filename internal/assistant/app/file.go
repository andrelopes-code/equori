package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
)

// unsentFileLife is how long a file no turn sent is kept (Q6).
const unsentFileLife = 24 * time.Hour

// UseFileSummary sets what describes an ofx or csv file to the model (F4).
func (s *Service) UseFileSummary(summarize func(kind string, content []byte) string) {
	s.summarize = summarize
}

// CreateFile stores a file the member attaches to a message of conversation, or to the next
// message when conversation is uuid.Nil. The kind comes from the content (F3).
func (s *Service) CreateFile(
	ctx context.Context,
	booksID, memberID int64,
	conversation uuid.UUID,
	name string,
	content []byte,
) (domain.File, error) {
	if len(content) > domain.MaxFileBytes {
		return domain.File{}, domain.ErrFileTooLarge
	}

	kind, mediaType, err := domain.DetectFileKind(content)
	if err != nil {
		return domain.File{}, err
	}

	if conversation != uuid.Nil {
		if _, err := s.repo.Conversation(ctx, booksID, memberID, conversation); err != nil {
			return domain.File{}, err
		}
	}

	now := s.now()
	f := domain.File{
		ID:             uuid.New(),
		ConversationID: conversation,
		Name:           fileName(name),
		MediaType:      mediaType,
		Kind:           kind,
		CreatedAt:      now,
	}

	if s.summarize != nil {
		f.Summary = s.summarize(string(kind), content)
	}

	return s.repo.StoreFile(
		ctx,
		booksID,
		memberID,
		f,
		content,
		now.Add(-unsentFileLife),
		domain.MaxConversationFileBytes,
	)
}

// FileContent returns the name, the kind and the content of a file of the member, for a tool that
// writes from it (F7); ErrFileNotFound when the member has no such file.
func (s *Service) FileContent(
	ctx context.Context,
	booksID, memberID int64,
	id uuid.UUID,
) (string, domain.FileKind, []byte, error) {
	return s.repo.FileContent(ctx, booksID, memberID, id)
}

// DeleteFile removes a file of the member that no turn sent yet (F2).
func (s *Service) DeleteFile(ctx context.Context, booksID, memberID int64, id uuid.UUID) error {
	return s.repo.DeleteUnsentFile(ctx, booksID, memberID, id)
}

// fileName keeps at most 255 characters of the name a client sent; an empty name reads "file".
func fileName(name string) string {
	runes := []rune(name)
	if len(runes) == 0 {
		return "file"
	}

	return string(runes[:min(len(runes), 255)])
}
