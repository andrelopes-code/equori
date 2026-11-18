package app

import (
	"context"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
)

// turnMessage trims the text of the message and reads the files it carries: the text may be
// empty only when a file is carried (F2). The pdf, image and text files become file parts when
// the model of the chat reads files, and are marked unread otherwise (F5).
func (s *Service) turnMessage(
	ctx context.Context,
	booksID, memberID int64,
	in TurnInput,
) (string, []domain.File, []FilePart, error) {
	text := strings.TrimSpace(in.Text)
	n := utf8.RuneCountInString(text)

	switch {
	case len(in.FileIDs) > domain.MaxTurnFiles:
		return "", nil, nil, ErrTooManyFiles
	case n > domain.MaxMessage, n == 0 && len(in.FileIDs) == 0:
		return "", nil, nil, ErrInvalidText
	case len(in.FileIDs) == 0:
		return text, nil, nil, nil
	}

	files, err := s.unsentFiles(ctx, booksID, memberID, in)
	if err != nil {
		return "", nil, nil, err
	}

	parts, err := s.fileParts(ctx, booksID, memberID, files)

	return text, files, parts, err
}

// unsentFiles reads the files a message carries: each is an unsent file of the member, uploaded
// for no conversation or for this one.
func (s *Service) unsentFiles(
	ctx context.Context,
	booksID, memberID int64,
	in TurnInput,
) ([]domain.File, error) {
	files, err := s.repo.UnsentFiles(ctx, booksID, memberID, in.FileIDs)
	if err != nil {
		return nil, err
	}

	if len(files) != len(in.FileIDs) {
		return nil, domain.ErrFileNotFound
	}

	for _, f := range files {
		if f.ConversationID != uuid.Nil && f.ConversationID != in.ConversationID {
			return nil, domain.ErrFileNotFound
		}
	}

	return files, nil
}

// fileParts reads the content of each readable file when a target of the chat reads files, and
// marks each readable file unread otherwise.
func (s *Service) fileParts(
	ctx context.Context,
	booksID, memberID int64,
	files []domain.File,
) ([]FilePart, error) {
	if !slices.ContainsFunc(files, func(f domain.File) bool { return f.Kind.Readable() }) {
		return nil, nil
	}

	reads, err := s.chatReadsFiles(ctx, booksID)
	if err != nil {
		return nil, err
	}

	var parts []FilePart

	for i, f := range files {
		switch {
		case !f.Kind.Readable():
			continue
		case !reads:
			files[i].Unread = true

			continue
		}

		_, _, content, err := s.repo.FileContent(ctx, booksID, memberID, f.ID)
		if err != nil {
			return nil, err
		}

		_, mediaType, err := domain.DetectFileKind(content)
		if err != nil {
			return nil, err
		}

		parts = append(parts, FilePart{MediaType: mediaType, Data: content})
	}

	return parts, nil
}

// chatReadsFiles reports whether a target of the chat declares image_input.
func (s *Service) chatReadsFiles(ctx context.Context, booksID int64) (bool, error) {
	use, ok := s.use(chatUseID)
	if !ok {
		return false, nil
	}

	use.Needs = append(slices.Clone(use.Needs), domain.CapImageInput)

	targets, err := s.candidates(ctx, booksID, true, use)

	return len(targets) > 0, err
}

// turnTitle titles a conversation by its first text, or by the name of its first file.
func turnTitle(text string, files []domain.File) string {
	if text == "" && len(files) > 0 {
		return domain.Title(files[0].Name)
	}

	return domain.Title(text)
}

// attachFiles gives each message the files it carried.
func attachFiles(messages []domain.Message, files []domain.File) {
	byMessage := map[uuid.UUID][]domain.File{}
	for _, f := range files {
		byMessage[f.MessageID] = append(byMessage[f.MessageID], f)
	}

	for i := range messages {
		messages[i].Files = byMessage[messages[i].ID]
	}
}
