package spreadsheet_test

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

const path = "/api/v1/spreadsheets"

type summaryView struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Version int    `json:"version"`
}

type documentView struct {
	summaryView

	Content map[string]any `json:"content"`
}

// S682: a document is created, read, saved, renamed, copied and deleted inside its book
// (spreadsheets design SS3, SS5, SS6).
func TestS682DocumentLifecycle(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	var created documentView

	r := h.Do(http.MethodPost, path, map[string]any{
		"name":    "  Budget 2027 ",
		"content": map[string]any{"id": "w1", "sheets": map[string]any{}},
	})
	if r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	r.Decode(t, &created)

	if created.Name != "Budget 2027" || created.Version != 1 || created.Content["id"] != "w1" ||
		r.Header.Get("Location") != path+"/"+created.ID {
		t.Fatalf("created = %+v, Location %q", created, r.Header.Get("Location"))
	}

	var saved summaryView
	h.MustDo(http.MethodPut, path+"/"+created.ID, map[string]any{
		"content": map[string]any{"id": "w2"},
		"version": 1,
	}, http.StatusOK, &saved)

	if saved.ID != created.ID || saved.Version != 2 {
		t.Fatalf("saved = %+v", saved)
	}

	// SS5: a save that read version 1 loses to the save above and stores nothing.
	h.ExpectProblem(
		h.Do(http.MethodPut, path+"/"+created.ID, map[string]any{
			"content": map[string]any{"id": "stale"},
			"version": 1,
		}),
		http.StatusConflict,
		"version_conflict",
		"",
	)

	var renamed summaryView
	h.MustDo(
		http.MethodPut,
		path+"/"+created.ID+"/name",
		map[string]any{"name": "Budget"},
		http.StatusOK,
		&renamed,
	)

	if renamed.Name != "Budget" || renamed.Version != 2 {
		t.Fatalf("renamed = %+v", renamed)
	}

	var got documentView
	h.MustDo(http.MethodGet, path+"/"+created.ID, nil, http.StatusOK, &got)

	if got.Name != "Budget" || got.Version != 2 || got.Content["id"] != "w2" {
		t.Fatalf("got = %+v", got)
	}

	var copied summaryView

	r = h.Do(http.MethodPost, path+"/"+created.ID+"/copies", map[string]any{"name": "Copy"})
	if r.Status != http.StatusCreated {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	r.Decode(t, &copied)

	var copyContent documentView
	h.MustDo(http.MethodGet, path+"/"+copied.ID, nil, http.StatusOK, &copyContent)

	if copied.ID == created.ID || copied.Name != "Copy" || copied.Version != 1 ||
		copyContent.Content["id"] != "w2" ||
		r.Header.Get("Location") != path+"/"+copied.ID {
		t.Fatalf("copied = %+v, content %v", copied, copyContent.Content)
	}

	var list struct {
		Items []summaryView `json:"items"`
	}
	h.MustDo(http.MethodGet, path, nil, http.StatusOK, &list)

	if len(list.Items) != 2 || list.Items[0] != copied || list.Items[1] != renamed {
		t.Fatalf("list = %+v", list.Items)
	}

	h.MustDo(http.MethodDelete, path+"/"+created.ID, nil, http.StatusNoContent, nil)
	h.ExpectProblem(
		h.Do(http.MethodDelete, path+"/"+created.ID, nil),
		http.StatusNotFound,
		"not_found",
		"",
	)
}

// S683: a missing document, a name outside its rule and a content above the limit are refused
// (SS3, SS4).
func TestS683DocumentProblems(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	content := map[string]any{"id": "w"}

	var doc summaryView
	h.MustDo(
		http.MethodPost,
		path,
		map[string]any{"name": "Mine", "content": content},
		http.StatusCreated,
		&doc,
	)

	missing := path + "/00000000-0000-7000-8000-000000000000"
	name := map[string]any{"name": "x"}

	notFound := []struct {
		method, path string
		body         any
	}{
		{http.MethodGet, missing, nil},
		{http.MethodPut, missing, map[string]any{"content": content, "version": 1}},
		{http.MethodPut, missing + "/name", name},
		{http.MethodPost, missing + "/copies", name},
	}
	for _, tt := range notFound {
		h.ExpectProblem(h.Do(tt.method, tt.path, tt.body), http.StatusNotFound, "not_found", "")
	}

	invalidNames := []string{"", "   ", strings.Repeat("a", 121), "a\tb"}
	for _, n := range invalidNames {
		in := map[string]any{"name": n}

		h.ExpectProblem(
			h.Do(http.MethodPost, path, map[string]any{"name": n, "content": content}),
			http.StatusUnprocessableEntity, "validation_failed", "name",
		)
		h.ExpectProblem(
			h.Do(http.MethodPut, path+"/"+doc.ID+"/name", in),
			http.StatusUnprocessableEntity, "validation_failed", "name",
		)
		h.ExpectProblem(
			h.Do(http.MethodPost, path+"/"+doc.ID+"/copies", in),
			http.StatusUnprocessableEntity, "validation_failed", "name",
		)
	}

	// SS4: the body limit of a write is 4 MiB plus the JSON framing.
	big := map[string]any{"cell": strings.Repeat("a", 5<<20)}
	h.ExpectProblem(
		h.Do(http.MethodPost, path, map[string]any{"name": "Big", "content": big}),
		http.StatusRequestEntityTooLarge, "request_too_large", "",
	)
	h.ExpectProblem(
		h.Do(http.MethodPut, path+"/"+doc.ID, map[string]any{"content": big, "version": 1}),
		http.StatusRequestEntityTooLarge, "request_too_large", "",
	)

	// A content of 2 MiB passes the default 1 MiB limit of a request.
	h.MustDo(http.MethodPut, path+"/"+doc.ID, map[string]any{
		"content": map[string]any{"cell": strings.Repeat("a", 2<<20)},
		"version": 1,
	}, http.StatusOK, nil)
}

// S684: a book holds at most 40 documents (SS4).
func TestS684DocumentLimit(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	var first summaryView

	for i := range 40 {
		h.MustDo(http.MethodPost, path, map[string]any{
			"name":    fmt.Sprintf("Sheet %d", i),
			"content": map[string]any{},
		}, http.StatusCreated, &first)
	}

	h.ExpectProblem(
		h.Do(http.MethodPost, path, map[string]any{"name": "41", "content": map[string]any{}}),
		http.StatusConflict, "spreadsheet_limit_reached", "",
	)
	h.ExpectProblem(
		h.Do(http.MethodPost, path+"/"+first.ID+"/copies", map[string]any{"name": "41"}),
		http.StatusConflict, "spreadsheet_limit_reached", "",
	)
}

// S685: read lists and opens; write is needed to change; another book sees nothing (SS11).
func TestS685DocumentAccess(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	content := map[string]any{"id": "w"}

	var doc summaryView
	h.MustDo(
		http.MethodPost,
		path,
		map[string]any{"name": "Mine", "content": content},
		http.StatusCreated,
		&doc,
	)

	one := path + "/" + doc.ID
	name := map[string]any{"name": "x"}
	reader := h.JoinAs("reader@example.com", h.OwnerID(), "read")

	for _, p := range []string{path, one} {
		if r := h.Call(reader, http.MethodGet, p, nil); r.Status != http.StatusOK {
			t.Fatalf("reader GET %s = %d: %s", p, r.Status, r.Body)
		}
	}

	writes := []struct {
		method, path string
		body         any
	}{
		{http.MethodPost, path, map[string]any{"name": "x", "content": content}},
		{http.MethodPut, one, map[string]any{"content": content, "version": 1}},
		{http.MethodPut, one + "/name", name},
		{http.MethodPost, one + "/copies", name},
		{http.MethodDelete, one, nil},
	}
	for _, tt := range writes {
		h.ExpectProblem(
			h.Call(reader, tt.method, tt.path, tt.body),
			http.StatusForbidden, "book_role_required", "",
		)
	}

	writer := h.JoinAs("writer@example.com", h.OwnerID(), "write")
	if r := h.Call(writer, http.MethodPut, one+"/name", name); r.Status != http.StatusOK {
		t.Fatalf("writer rename = %d: %s", r.Status, r.Body)
	}

	other := h.Login("other@example.com")

	var list struct {
		Items []summaryView `json:"items"`
	}

	r := h.Call(other, http.MethodGet, path, nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status %d: %s", r.Status, r.Body)
	}

	r.Decode(t, &list)

	if len(list.Items) != 0 {
		t.Fatalf("another book lists %+v", list.Items)
	}

	for _, tt := range writes[1:] {
		h.ExpectProblem(
			h.Call(other, tt.method, tt.path, tt.body),
			http.StatusNotFound, "not_found", "",
		)
	}

	h.ExpectProblem(h.Call(other, http.MethodGet, one, nil), http.StatusNotFound, "not_found", "")
}
