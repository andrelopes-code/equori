package postgres

import (
	"context"

	"github.com/andrelopes-code/equori/internal/platform/page"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
)

func (r *Repository) InsertAttachment(ctx context.Context, a app.Attachment, content []byte) (app.Attachment, error) {
	err := r.q.UpsertAttachmentBlob(ctx, UpsertAttachmentBlobParams{UserID: a.UserID, Sha256: a.SHA256, Size: int32(len(content)), Content: content}) //nolint:gosec // content is at most app.MaxAttachmentBytes
	if err != nil {
		return app.Attachment{}, err
	}
	row, err := r.q.UpsertAttachment(ctx, UpsertAttachmentParams{
		UserID: a.UserID, TransactionID: a.TransactionID, Sha256: a.SHA256, FileName: a.FileName, MediaType: a.MediaType,
	})
	if err != nil {
		return app.Attachment{}, err
	}
	return app.Attachment{
		ID: row.ID, UserID: row.UserID, TransactionID: row.TransactionID, FileName: row.FileName,
		MediaType: row.MediaType, Size: int64(len(content)), SHA256: row.Sha256, CreatedAt: row.CreatedAt,
	}, nil
}

func (r *Repository) Attachments(ctx context.Context, userID int64, transactionID uuid.UUID, p page.Request[app.AttachmentKey]) ([]app.Attachment, *app.AttachmentKey, error) {
	params := ListAttachmentsParams{UserID: userID, TransactionID: transactionID, RowLimit: rowLimit(p.Limit)}
	if p.After != nil {
		params.AfterCreated, params.AfterID = &p.After.CreatedAt, nullUUID(p.After.ID)
	}
	rows, err := r.q.ListAttachments(ctx, params)
	if err != nil {
		return nil, nil, err
	}
	items, next := pageOf(rows, p.Limit,
		func(row ListAttachmentsRow) app.Attachment {
			return app.Attachment{
				ID: row.ID, UserID: row.UserID, TransactionID: row.TransactionID, FileName: row.FileName,
				MediaType: row.MediaType, Size: int64(row.Size), SHA256: row.Sha256, CreatedAt: row.CreatedAt,
			}
		},
		func(row ListAttachmentsRow) app.AttachmentKey {
			return app.AttachmentKey{CreatedAt: row.CreatedAt, ID: row.ID}
		})
	return items, next, nil
}

func (r *Repository) AttachmentContent(ctx context.Context, userID int64, id uuid.UUID) (app.AttachmentContent, error) {
	row, err := r.q.GetAttachmentContent(ctx, GetAttachmentContentParams{UserID: userID, ID: id})
	if err != nil {
		return app.AttachmentContent{}, notFound(err)
	}
	return app.AttachmentContent{FileName: row.FileName, MediaType: row.MediaType, Content: row.Content}, nil
}

func (r *Repository) DeleteAttachment(ctx context.Context, userID int64, id uuid.UUID) error {
	sum, err := r.q.DeleteAttachment(ctx, DeleteAttachmentParams{UserID: userID, ID: id})
	if err != nil {
		return notFound(err)
	}
	return r.q.DeleteUnreferencedBlob(ctx, DeleteUnreferencedBlobParams{UserID: userID, Sha256: sum})
}
