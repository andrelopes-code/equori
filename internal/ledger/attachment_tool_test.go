package ledger_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
)

// Assistant parity design F7: a file attached to the conversation is attached to a transaction
// through the service of createAttachment, and detach_attachment removes it as
// deleteAttachment does.
func TestAttachFileTools(t *testing.T) {
	t.Parallel()
	h, groceries, _ := newAttachmentSetup(t)

	r := h.Upload("/api/v1/assistant/files", "recibo.pdf", pdf(2048))
	if r.Status != http.StatusCreated {
		t.Fatalf("upload status %d: %s", r.Status, r.Body)
	}

	var file struct {
		ID string `json:"id"`
	}
	r.Decode(t, &file)

	res := h.Tool("attach_file", map[string]any{"file_id": file.ID, "transaction_id": groceries})
	if res.IsError {
		t.Fatalf("attach_file = %s", res.Content)
	}

	var attached struct {
		AttachmentID string `json:"attachment_id"`
		FileName     string `json:"file_name"`
	}
	if err := json.Unmarshal(res.Content, &attached); err != nil {
		t.Fatal(err)
	}

	if list := attachmentsOf(
		t,
		h,
		groceries,
	); len(list) != 1 || list[0].ID != attached.AttachmentID ||
		list[0].FileName != "recibo.pdf" ||
		list[0].MediaType != "application/pdf" {
		t.Fatalf("attachments = %+v, want recibo.pdf %s", list, attached.AttachmentID)
	}

	h.JoinAs("reader@example.com", h.OwnerID(), "read")
	h.ExpectToolError(
		h.ToolAs("reader@example.com", auth.RoleRead, "attach_file", map[string]any{
			"file_id": file.ID, "transaction_id": groceries,
		}),
		"book_role_required",
		"",
	)
	h.ExpectToolError(
		h.Tool("attach_file", map[string]any{
			"file_id":        "88888888-8888-8888-8888-888888888888",
			"transaction_id": groceries,
		}),
		"invalid_arguments",
		"file_id",
	)

	if res := h.Tool(
		"detach_attachment",
		map[string]any{"attachment_id": attached.AttachmentID},
	); res.IsError {
		t.Fatalf("detach_attachment = %s", res.Content)
	}

	if list := attachmentsOf(t, h, groceries); len(list) != 0 {
		t.Errorf("attachments after detach = %+v, want none", list)
	}
}

func attachmentsOf(t *testing.T, h *apitest.Harness, transaction string) []attachmentView {
	t.Helper()

	var list struct {
		Items []attachmentView `json:"items"`
	}
	h.MustDo(
		http.MethodGet,
		"/api/v1/transactions/"+transaction+"/attachments",
		nil,
		http.StatusOK,
		&list,
	)

	return list.Items
}
