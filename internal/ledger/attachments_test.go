package ledger_test

import (
	"bytes"
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type attachmentView struct {
	ID        string `json:"id"`
	FileName  string `json:"file_name"`
	MediaType string `json:"media_type"`
	Size      int64  `json:"size"`
	SHA256    string `json:"sha256"`
}

const mib = 1 << 20

func pdf(size int) []byte {
	return append([]byte("%PDF-1.7\n"), bytes.Repeat([]byte("x"), size-9)...)
}

func attach(h *apitest.Harness, transaction, name string, content []byte) apitest.Response {
	return h.Upload("/api/v1/transactions/"+transaction+"/attachments", name, content)
}

func mustAttach(t *testing.T, h *apitest.Harness, transaction, name string, content []byte) attachmentView {
	t.Helper()
	resp := attach(h, transaction, name, content)
	if resp.Status != http.StatusCreated {
		t.Fatalf("upload status %d: %s", resp.Status, resp.Body)
	}
	var a attachmentView
	resp.Decode(t, &a)
	return a
}

func blobCount(t *testing.T, h *apitest.Harness) int {
	t.Helper()
	var n int
	if err := h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM ledger_attachment_blob`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func newAttachmentSetup(t *testing.T) (*apitest.Harness, string, string) {
	h := apitest.New(t)
	checking := h.Account("Nubank", "asset", "checking", nil)
	food := h.Account("Food", "expense", "", nil)
	return h, h.Record("2026-10-05", apitest.Posting(checking, -25000), apitest.Posting(food, 25000)),
		h.Record("2026-10-06", apitest.Posting(checking, -1000), apitest.Posting(food, 1000))
}

func TestAttachmentStoresSharedContentOnce(t *testing.T) {
	h, groceries, other := newAttachmentSetup(t)
	content := pdf(230 * 1024)
	first := mustAttach(t, h, groceries, "receipt.pdf", content)
	second := mustAttach(t, h, other, "copy.pdf", content)
	if first.MediaType != "application/pdf" || first.Size != int64(len(content)) || first.SHA256 != second.SHA256 || first.ID == second.ID {
		t.Fatalf("attachments = %+v, %+v", first, second)
	}
	if n := blobCount(t, h); n != 1 {
		t.Fatalf("blobs = %d, want 1", n)
	}
	if again := mustAttach(t, h, groceries, "receipt-again.pdf", content); again.ID != first.ID {
		t.Fatalf("re-upload created attachment %s, want %s", again.ID, first.ID)
	}

	var list struct {
		Items []attachmentView `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+groceries+"/attachments", nil, http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].ID != first.ID {
		t.Fatalf("list = %+v", list.Items)
	}

	resp := h.Do(http.MethodGet, "/api/v1/attachments/"+first.ID+"/content", nil)
	if resp.Status != http.StatusOK || !bytes.Equal(resp.Body, content) || resp.Header.Get("Content-Type") != "application/pdf" ||
		!strings.HasPrefix(resp.Header.Get("Content-Disposition"), "attachment;") {
		t.Fatalf("content: status %d, headers %v, %d bytes", resp.Status, resp.Header, len(resp.Body))
	}

	h.MustDo(http.MethodDelete, "/api/v1/attachments/"+first.ID, nil, http.StatusNoContent, nil)
	if resp := h.Do(http.MethodGet, "/api/v1/attachments/"+second.ID+"/content", nil); resp.Status != http.StatusOK || !bytes.Equal(resp.Body, content) {
		t.Fatalf("shared content after deleting the other attachment: status %d", resp.Status)
	}
	h.MustDo(http.MethodDelete, "/api/v1/attachments/"+second.ID, nil, http.StatusNoContent, nil)
	if n := blobCount(t, h); n != 0 {
		t.Fatalf("blobs after deleting every attachment = %d, want 0", n)
	}
}

func TestAttachmentSizeLimit(t *testing.T) {
	h, groceries, _ := newAttachmentSetup(t)
	mustAttach(t, h, groceries, "max.pdf", pdf(10*mib))
	h.ExpectProblem(attach(h, groceries, "over.pdf", pdf(10*mib+1)), http.StatusUnprocessableEntity, "validation_failed", "file")
	h.ExpectProblem(attach(h, groceries, "large.pdf", pdf(12*mib)), http.StatusUnprocessableEntity, "validation_failed", "file")
	if n := blobCount(t, h); n != 1 {
		t.Fatalf("blobs = %d, want only the accepted file", n)
	}
}

func TestAttachmentRejectsUnsupportedContent(t *testing.T) {
	h, groceries, _ := newAttachmentSetup(t)
	h.ExpectProblem(attach(h, groceries, "data.bin", []byte{0, 1, 2, 3, 4}), http.StatusUnprocessableEntity, "validation_failed", "file")
	h.ExpectProblem(attach(h, groceries, "empty.txt", nil), http.StatusUnprocessableEntity, "validation_failed", "file")
	if a := mustAttach(t, h, groceries, "note.txt", []byte("paid in cash")); a.MediaType != "text/plain" {
		t.Fatalf("media type = %q", a.MediaType)
	}
}

func TestAttachmentOfAnotherUserIs404(t *testing.T) {
	h, groceries, _ := newAttachmentSetup(t)
	a := mustAttach(t, h, groceries, "receipt.pdf", pdf(1024))
	other := h.Login("other@example.com")
	for _, r := range []apitest.Response{
		h.Call(other, http.MethodGet, "/api/v1/attachments/"+a.ID+"/content", nil),
		h.Call(other, http.MethodDelete, "/api/v1/attachments/"+a.ID, nil),
		h.Call(other, http.MethodGet, "/api/v1/transactions/"+groceries+"/attachments", nil),
	} {
		h.ExpectProblem(r, http.StatusNotFound, "not_found", "")
	}
}
