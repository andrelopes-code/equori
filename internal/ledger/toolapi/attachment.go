package toolapi

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// ConversationFile reads the name and the content of a file the member attached to the
// conversation; false when the member has no such file (assistant parity design, F7).
type ConversationFile func(
	ctx context.Context,
	booksID, memberID int64,
	id uuid.UUID,
) (name string, content []byte, found bool, err error)

type attachFileIn struct {
	FileID        string `json:"file_id"        jsonschema:"id of a file the user attached, from the [file ...] line of the message"`
	TransactionID string `json:"transaction_id" jsonschema:"transaction the file documents"`
}

type attachFileOut struct {
	AttachmentID string `json:"attachment_id"`
	FileName     string `json:"file_name"`
}

type detachAttachmentIn struct {
	AttachmentID string `json:"attachment_id" jsonschema:"attachment id, from get_transaction or attach_file"`
}

type detachAttachmentOut struct {
	Deleted bool `json:"deleted"`
}

func attachFile(svc *app.Service, files ConversationFile) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "attach_file",
		Description: "Proposes attaching a file the user attached to the conversation, such as a receipt photo or " +
			"a PDF, to one transaction, as Transaction detail does. Use it after recording or finding the " +
			"transaction the file documents. Do not use it to import a statement: import_statement_file does. " +
			"The user confirms first.",
		Effect: tool.Write,
		Role:   auth.RoleWrite,
	}, func(ctx context.Context, booksID int64, in attachFileIn) (tool.Preview, error) {
		name, _, transaction, err := attachInput(ctx, booksID, svc, files, in)
		if err != nil {
			return tool.Preview{}, err
		}

		return tool.Preview{Action: "attach_file", Changes: []tool.Change{
			{Field: "source", After: tool.TextValue(name)},
			{Field: "transaction", After: tool.TextValue(transaction)},
		}}, nil
	}, func(ctx context.Context, booksID int64, in attachFileIn) (attachFileOut, error) {
		name, content, _, err := attachInput(ctx, booksID, svc, files, in)
		if err != nil {
			return attachFileOut{}, err
		}

		a, err := svc.Attach(
			ctx,
			booksID,
			uuid.MustParse(in.TransactionID),
			name,
			http.DetectContentType(content),
			content,
		)
		if err != nil {
			return attachFileOut{}, err
		}

		return attachFileOut{AttachmentID: a.ID.String(), FileName: a.FileName}, nil
	})
}

func detachAttachment(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "detach_attachment",
		Description: "Proposes removing an attachment from its transaction; the file is deleted when no other " +
			"transaction holds it. Use it when the user asks to remove an attachment. " +
			"Do not use it to void the transaction: void_transaction does. The user confirms first.",
		Effect: tool.Destructive,
		Role:   auth.RoleWrite,
	}, func(ctx context.Context, booksID int64, in detachAttachmentIn) (tool.Preview, error) {
		id, err := uuid.Parse(in.AttachmentID)
		if err != nil {
			return tool.Preview{}, tool.InvalidArgument("attachment_id", "is not a UUID")
		}

		a, err := svc.AttachmentContent(ctx, booksID, id)
		if err != nil {
			return tool.Preview{}, err
		}

		return tool.Preview{Action: "detach_attachment", Changes: []tool.Change{
			{Field: "source", Before: tool.TextValue(a.FileName)},
		}}, nil
	}, func(ctx context.Context, booksID int64, in detachAttachmentIn) (detachAttachmentOut, error) {
		id, err := uuid.Parse(in.AttachmentID)
		if err != nil {
			return detachAttachmentOut{}, tool.InvalidArgument("attachment_id", "is not a UUID")
		}

		if err := svc.DeleteAttachment(ctx, booksID, id); err != nil {
			return detachAttachmentOut{}, err
		}

		return detachAttachmentOut{Deleted: true}, nil
	})
}

// attachInput reads the file of the member and names the transaction of a call by its date and
// description.
func attachInput(
	ctx context.Context,
	booksID int64,
	svc *app.Service,
	files ConversationFile,
	in attachFileIn,
) (string, []byte, string, error) {
	fileID, err := uuid.Parse(in.FileID)
	if err != nil {
		return "", nil, "", tool.InvalidArgument("file_id", "is not a UUID")
	}

	transactionID, err := uuid.Parse(in.TransactionID)
	if err != nil {
		return "", nil, "", tool.InvalidArgument("transaction_id", "is not a UUID")
	}

	name, content, found, err := files(ctx, booksID, auth.MustMemberID(ctx), fileID)
	if err != nil {
		return "", nil, "", err
	}

	if !found {
		return "", nil, "", tool.InvalidArgument("file_id", "is not a file of this conversation")
	}

	t, err := svc.Transaction(ctx, booksID, transactionID)
	if err != nil {
		return "", nil, "", err
	}

	return name, content, t.Date.Format("2006-01-02") + " " + t.Description, nil
}
