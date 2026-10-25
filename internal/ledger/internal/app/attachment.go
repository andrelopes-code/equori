package app

import (
	"context"
	"crypto/sha256"
	"mime"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"
)

// MaxAttachmentBytes is the content limit of one attachment (N26).
const MaxAttachmentBytes = 10 << 20

// attachmentMediaTypes are the accepted types, as content sniffing reports them.
var attachmentMediaTypes = map[string]bool{
	"application/pdf": true, "image/jpeg": true, "image/png": true, "image/webp": true, "text/plain": true,
}

type Attachment struct {
	ID            uuid.UUID
	UserID        int64
	TransactionID uuid.UUID
	FileName      string
	MediaType     string
	Size          int64
	SHA256        []byte
	CreatedAt     time.Time
}

type AttachmentContent struct {
	FileName  string
	MediaType string
	Content   []byte
}

// Attach stores content once per user and hash (D2); attaching the same file to the
// same transaction again returns the existing attachment. detected is the media type
// sniffed from the content, never the one the client declares.
func (s *Service) Attach(ctx context.Context, userID int64, transactionID uuid.UUID, fileName, detected string, content []byte) (Attachment, error) {
	switch {
	case fileName == "" || utf8.RuneCountInString(fileName) > 255:
		return Attachment{}, validationError("file", "must have a file name of 1 to 255 characters")
	case len(content) == 0:
		return Attachment{}, validationError("file", "must not be empty")
	case len(content) > MaxAttachmentBytes:
		return Attachment{}, validationError("file", "must be at most 10 MiB")
	}
	mediaType, _, err := mime.ParseMediaType(detected)
	if err != nil || !attachmentMediaTypes[mediaType] {
		return Attachment{}, validationError("file", "must be a PDF, JPEG, PNG, WebP or plain text file")
	}
	if _, err := s.repo.Transaction(ctx, userID, transactionID); err != nil {
		return Attachment{}, err
	}
	sum := sha256.Sum256(content)
	var created Attachment
	err = s.repo.InTx(ctx, func(r Repository) error {
		var err error
		created, err = r.InsertAttachment(ctx, Attachment{
			UserID: userID, TransactionID: transactionID, FileName: fileName, MediaType: mediaType, SHA256: sum[:],
		}, content)
		return err
	})
	return created, err
}

func (s *Service) Attachments(ctx context.Context, userID int64, transactionID uuid.UUID, p page.Request[AttachmentKey]) ([]Attachment, *AttachmentKey, error) {
	if _, err := s.repo.Transaction(ctx, userID, transactionID); err != nil {
		return nil, nil, err
	}
	return s.repo.Attachments(ctx, userID, transactionID, p)
}

func (s *Service) AttachmentContent(ctx context.Context, userID int64, id uuid.UUID) (AttachmentContent, error) {
	return s.repo.AttachmentContent(ctx, userID, id)
}

func (s *Service) DeleteAttachment(ctx context.Context, userID int64, id uuid.UUID) error {
	return s.repo.InTx(ctx, func(r Repository) error { return r.DeleteAttachment(ctx, userID, id) })
}

// Inlineable reports whether a file of this media type may be shown in place: a PDF or an image.
func Inlineable(mediaType string) bool {
	return mediaType == "application/pdf" || strings.HasPrefix(mediaType, "image/")
}
