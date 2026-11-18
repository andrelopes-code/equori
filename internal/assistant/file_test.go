package assistant_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const filesPath = "/api/v1/assistant/files"

type storedFile struct {
	ID             string `json:"id"`
	ConversationID string `json:"conversation_id"`
	Name           string `json:"name"`
	Kind           string `json:"kind"`
	Size           int    `json:"size"`
}

// Assistant parity design F2, F3 and F9: a file is stored with the kind its content has, and the
// same content twice returns the stored file.
func TestCreateAssistantFile(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	statement := apitest.OFX("100.00")
	first := uploadFile(t, h, h.Client, nil, "extrato.ofx", statement, http.StatusCreated)

	if first.Kind != "ofx" || first.Name != "extrato.ofx" || first.Size != len(statement) ||
		first.ConversationID != "" {
		t.Errorf("file = %+v, want an unsent ofx of %d bytes", first, len(statement))
	}

	again := uploadFile(t, h, h.Client, nil, "copy.txt", statement, http.StatusCreated)
	if again.ID != first.ID || again.Name != "extrato.ofx" {
		t.Errorf("same content = %+v, want the stored file %s", again, first.ID)
	}

	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")
	if f := uploadFile(
		t,
		h,
		reader,
		nil,
		"nota.pdf",
		[]byte("%PDF-1.7\n1 0 obj"),
		http.StatusCreated,
	); f.Kind != "pdf" {
		t.Errorf("file of a reader = %+v, want pdf", f)
	}
}

func TestCreateAssistantFileProblems(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	h.ExpectProblem(
		h.Upload(filesPath, "archive.zip", []byte("PK\x03\x04\x14\x00\x00\x00")),
		http.StatusUnsupportedMediaType,
		"file_kind_unsupported",
		"",
	)
	h.ExpectProblem(
		h.Upload(filesPath, "big.txt", bytes.Repeat([]byte("a"), 10<<20+1)),
		http.StatusRequestEntityTooLarge,
		"file_too_large",
		"",
	)
	h.ExpectProblem(
		h.UploadWith(
			filesPath,
			map[string]string{"conversation_id": "44444444-4444-4444-4444-444444444444"},
			"a.txt",
			[]byte("text"),
		),
		http.StatusNotFound,
		"conversation_not_found",
		"",
	)

	// Five files of 10 MiB fill the 50 MiB of the unsent files; a sixth is refused.
	for i := range 5 {
		content := append(bytes.Repeat([]byte("a"), 10<<20-1), byte('0'+i))
		uploadFile(t, h, h.Client, nil, "part.txt", content, http.StatusCreated)
	}

	h.ExpectProblem(
		h.Upload(filesPath, "sixth.txt", []byte("one byte more")),
		http.StatusConflict,
		"conversation_files_full",
		"",
	)
}

// Assistant parity design F2 and B2: a file not yet sent is removed; a file of another member or
// book is not found.
func TestDeleteAssistantFile(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	f := uploadFile(t, h, h.Client, nil, "a.txt", []byte("receipt"), http.StatusCreated)

	other := h.Login("other@example.com")
	h.ExpectProblem(
		h.Call(other, http.MethodDelete, filesPath+"/"+f.ID, nil),
		http.StatusNotFound,
		"file_not_found",
		"",
	)

	if r := h.Do(http.MethodDelete, filesPath+"/"+f.ID, nil); r.Status != http.StatusNoContent {
		t.Fatalf("delete status %d: %s", r.Status, r.Body)
	}

	h.ExpectProblem(
		h.Do(http.MethodDelete, filesPath+"/"+f.ID, nil),
		http.StatusNotFound,
		"file_not_found",
		"",
	)
}

func uploadFile(
	t *testing.T,
	h *apitest.Harness,
	c *http.Client,
	fields map[string]string,
	name string,
	content []byte,
	status int,
) storedFile {
	t.Helper()

	r := h.UploadAs(c, filesPath, fields, name, content)
	if r.Status != status {
		t.Fatalf("upload %s: status %d, want %d: %s", name, r.Status, status, r.Body)
	}

	var f storedFile
	if err := json.Unmarshal(r.Body, &f); err != nil {
		t.Fatal(err)
	}

	return f
}
