package postgres

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
)

// StoreFile deletes the unsent files of the member created before staleBefore, then stores f
// with its content: the same content already stored for the same conversation returns the stored
// file (F9), and a file that takes the files of the conversation past limit bytes is refused with
// ErrConversationFilesFull (F3).
//
// shortcut: two uploads at the same instant can each pass the limit check; a row lock on the
// conversation would close it, when the limit has to hold to the byte.
func (r *Repository) StoreFile(
	ctx context.Context,
	booksID, memberID int64,
	f domain.File,
	content []byte,
	staleBefore time.Time,
	limit int64,
) (domain.File, error) {
	sum := sha256.Sum256(content)
	conversation := nullUUID(f.ConversationID)

	var stored domain.File

	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)

		if err := q.DeleteStaleUnsentFiles(ctx, DeleteStaleUnsentFilesParams{
			BooksID:  booksID,
			MemberID: memberID,
			Before:   staleBefore,
		}); err != nil {
			return fmt.Errorf("delete stale files: %w", err)
		}

		row, err := q.FileBySHA(ctx, FileBySHAParams{
			BooksID:        booksID,
			MemberID:       memberID,
			ConversationID: conversation,
			Sha256:         sum[:],
		})
		if err == nil {
			stored = toFile(row)

			return nil
		}

		if !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("find file by hash: %w", err)
		}

		if err := storeNewFile(ctx, q, booksID, memberID, f, content, sum[:], limit); err != nil {
			return err
		}

		stored = f
		stored.Size = len(content)

		return nil
	})

	return stored, err
}

// storeNewFile stores f unless it takes the files of its conversation past limit bytes.
func storeNewFile(
	ctx context.Context,
	q *Queries,
	booksID, memberID int64,
	f domain.File,
	content, sum []byte,
	limit int64,
) error {
	conversation := nullUUID(f.ConversationID)

	used, err := q.FileBytes(ctx, FileBytesParams{
		BooksID:        booksID,
		MemberID:       memberID,
		ConversationID: conversation,
	})
	if err != nil {
		return fmt.Errorf("sum file bytes: %w", err)
	}

	if used+int64(len(content)) > limit {
		return domain.ErrConversationFilesFull
	}

	//nolint:gosec // a file holds at most domain.MaxFileBytes
	size := int32(len(content))

	if _, err := q.InsertFile(ctx, InsertFileParams{
		ID:             f.ID,
		BooksID:        booksID,
		MemberID:       memberID,
		ConversationID: conversation,
		Name:           f.Name,
		MediaType:      f.MediaType,
		Kind:           string(f.Kind),
		Size:           size,
		Sha256:         sum,
		Content:        content,
		Summary:        f.Summary,
		CreatedAt:      f.CreatedAt,
	}); err != nil {
		return fmt.Errorf("insert file: %w", err)
	}

	return nil
}

// DeleteUnsentFile removes a file of the member that no turn sent; ErrFileNotFound otherwise.
func (r *Repository) DeleteUnsentFile(
	ctx context.Context,
	booksID, memberID int64,
	id uuid.UUID,
) error {
	n, err := r.q.DeleteUnsentFile(ctx, DeleteUnsentFileParams{
		BooksID:  booksID,
		MemberID: memberID,
		ID:       id,
	})
	if err != nil {
		return fmt.Errorf("delete file: %w", err)
	}

	if n == 0 {
		return domain.ErrFileNotFound
	}

	return nil
}

func toFile(row FileBySHARow) domain.File {
	return domain.File{
		ID:             row.ID,
		ConversationID: row.ConversationID.UUID,
		Name:           row.Name,
		MediaType:      row.MediaType,
		Kind:           domain.FileKind(row.Kind),
		Size:           int(row.Size),
		CreatedAt:      row.CreatedAt,
		Summary:        row.Summary,
	}
}

func nullUUID(id uuid.UUID) uuid.NullUUID {
	return uuid.NullUUID{UUID: id, Valid: id != uuid.Nil}
}

// UnsentFiles returns the unsent files of the member among ids, oldest first.
func (r *Repository) UnsentFiles(
	ctx context.Context,
	booksID, memberID int64,
	ids []uuid.UUID,
) ([]domain.File, error) {
	rows, err := r.q.UnsentFiles(
		ctx,
		UnsentFilesParams{BooksID: booksID, MemberID: memberID, Ids: ids},
	)
	if err != nil {
		return nil, fmt.Errorf("read unsent files: %w", err)
	}

	files := make([]domain.File, len(rows))
	for i, row := range rows {
		files[i] = domain.File{
			ID:             row.ID,
			ConversationID: row.ConversationID.UUID,
			Name:           row.Name,
			Kind:           domain.FileKind(row.Kind),
			Size:           int(row.Size),
			Summary:        row.Summary,
		}
	}

	return files, nil
}

// ConversationFiles returns the sent files of a conversation, oldest first.
func (r *Repository) ConversationFiles(
	ctx context.Context,
	booksID int64,
	conversationID uuid.UUID,
) ([]domain.File, error) {
	rows, err := r.q.FilesOfConversation(ctx, FilesOfConversationParams{
		BooksID:        booksID,
		ConversationID: nullUUID(conversationID),
	})
	if err != nil {
		return nil, fmt.Errorf("read conversation files: %w", err)
	}

	files := make([]domain.File, len(rows))
	for i, row := range rows {
		files[i] = domain.File{
			ID:             row.ID,
			ConversationID: conversationID,
			MessageID:      row.MessageID.UUID,
			Name:           row.Name,
			Kind:           domain.FileKind(row.Kind),
			Size:           int(row.Size),
			Summary:        row.Summary,
		}
	}

	return files, nil
}

// FileContent returns the name, the kind and the content of a file of the member;
// ErrFileNotFound when the member has no such file.
func (r *Repository) FileContent(
	ctx context.Context,
	booksID, memberID int64,
	id uuid.UUID,
) (string, domain.FileKind, []byte, error) {
	row, err := r.q.FileContent(
		ctx,
		FileContentParams{BooksID: booksID, MemberID: memberID, ID: id},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", nil, domain.ErrFileNotFound
	}

	if err != nil {
		return "", "", nil, fmt.Errorf("read file content: %w", err)
	}

	return row.Name, domain.FileKind(row.Kind), row.Content, nil
}
