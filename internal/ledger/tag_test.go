package ledger_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type tagUsage struct {
	Name         string `json:"name"`
	Transactions int    `json:"transactions"`
}

type taggedView struct {
	Version int      `json:"version"`
	Tags    []string `json:"tags"`
}

func tagNames(t *testing.T, h *apitest.Harness) []string {
	t.Helper()
	var out struct {
		Items []string `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/tags?limit=200", nil, http.StatusOK, &out)
	return out.Items
}

func tagged(t *testing.T, h *apitest.Harness, id string) taggedView {
	t.Helper()
	var out taggedView
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+id, nil, http.StatusOK, &out)
	return out
}

// taggedSetup records two live transactions and one voided transaction with tags.
type taggedSetup struct {
	c                  categoryTree
	both, trip, voided string
}

func newTaggedSetup(t *testing.T) taggedSetup {
	t.Helper()
	c := newCategoryTree(t)
	record := func(tags ...string) string {
		body := tx("2026-10-01", apitest.Posting(c.checking, -4500), apitest.Posting(c.delivery, 4500))
		body["tags"] = tags
		var out idOnly
		c.h.MustDo(http.MethodPost, "/api/v1/transactions", body, http.StatusCreated, &out)
		return out.ID
	}
	s := taggedSetup{c: c, both: record("trip", "travel"), trip: record("trip"), voided: record("trip")}
	c.h.MustDo(http.MethodPost, "/api/v1/transactions/"+s.voided+"/void", map[string]string{"reason": "duplicate"}, http.StatusOK, nil)
	return s
}

// A tag reports how many live transactions carry it; an unknown tag is 404.
func TestGetTag(t *testing.T) {
	t.Parallel()
	s := newTaggedSetup(t)
	var got tagUsage
	s.c.h.MustDo(http.MethodGet, "/api/v1/tags/trip", nil, http.StatusOK, &got)
	if got != (tagUsage{Name: "trip", Transactions: 2}) {
		t.Fatalf("tag = %+v", got)
	}
	s.c.h.ExpectProblem(s.c.h.Do(http.MethodGet, "/api/v1/tags/absent", nil), http.StatusNotFound, "not_found", "")
}

// A rename changes the name on every transaction without a new version; a name in use
// or a malformed name is rejected.
func TestRenameTag(t *testing.T) {
	t.Parallel()
	s := newTaggedSetup(t)
	h := s.c.h
	var got tagUsage
	h.MustDo(http.MethodPatch, "/api/v1/tags/trip", map[string]string{"name": "Lisbon 2026"}, http.StatusOK, &got)
	if got != (tagUsage{Name: "lisbon-2026", Transactions: 2}) {
		t.Fatalf("renamed = %+v", got)
	}
	if v := tagged(t, h, s.trip); v.Version != 1 || !slices.Equal(v.Tags, []string{"lisbon-2026"}) {
		t.Fatalf("transaction = %+v", v)
	}
	if names := tagNames(t, h); !slices.Equal(names, []string{"lisbon-2026", "travel"}) {
		t.Fatalf("tags = %v", names)
	}
	h.ExpectProblem(h.Do(http.MethodPatch, "/api/v1/tags/lisbon-2026", map[string]string{"name": "travel"}), http.StatusUnprocessableEntity, "validation_failed", "name")
	h.ExpectProblem(h.Do(http.MethodPatch, "/api/v1/tags/lisbon-2026", map[string]string{"name": "-x"}), http.StatusUnprocessableEntity, "validation_failed", "name")
	h.ExpectProblem(h.Do(http.MethodPatch, "/api/v1/tags/absent", map[string]string{"name": "other"}), http.StatusNotFound, "not_found", "")
}

// A merge gives each live transaction of the source a new version carrying the
// destination once; a voided transaction names the destination in place.
func TestMergeTags(t *testing.T) {
	t.Parallel()
	s := newTaggedSetup(t)
	h := s.c.h
	var got tagUsage
	h.MustDo(http.MethodPost, "/api/v1/tags/trip/merge", map[string]string{"into": "travel"}, http.StatusOK, &got)
	if got != (tagUsage{Name: "travel", Transactions: 2}) {
		t.Fatalf("destination = %+v", got)
	}
	for id, want := range map[string]taggedView{
		s.both:   {Version: 2, Tags: []string{"travel"}},
		s.trip:   {Version: 2, Tags: []string{"travel"}},
		s.voided: {Version: 1, Tags: []string{"travel"}},
	} {
		if v := tagged(t, h, id); v.Version != want.Version || !slices.Equal(v.Tags, want.Tags) {
			t.Fatalf("transaction %s = %+v, want %+v", id, v, want)
		}
	}
	if names := tagNames(t, h); !slices.Equal(names, []string{"travel"}) {
		t.Fatalf("tags = %v", names)
	}
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/tags/travel/merge", map[string]string{"into": "travel"}), http.StatusUnprocessableEntity, "validation_failed", "into")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/tags/travel/merge", map[string]string{"into": "absent"}), http.StatusUnprocessableEntity, "validation_failed", "into")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/tags/absent/merge", map[string]string{"into": "travel"}), http.StatusNotFound, "not_found", "")
}

// A delete gives each live transaction of the tag a new version without it.
func TestDeleteTag(t *testing.T) {
	t.Parallel()
	s := newTaggedSetup(t)
	h := s.c.h
	h.MustDo(http.MethodDelete, "/api/v1/tags/trip", nil, http.StatusNoContent, nil)
	for id, want := range map[string]taggedView{
		s.both:   {Version: 2, Tags: []string{"travel"}},
		s.trip:   {Version: 2, Tags: []string{}},
		s.voided: {Version: 1, Tags: []string{}},
	} {
		if v := tagged(t, h, id); v.Version != want.Version || !slices.Equal(v.Tags, want.Tags) {
			t.Fatalf("transaction %s = %+v, want %+v", id, v, want)
		}
	}
	if names := tagNames(t, h); !slices.Equal(names, []string{"travel"}) {
		t.Fatalf("tags = %v", names)
	}
	h.ExpectProblem(h.Do(http.MethodDelete, "/api/v1/tags/trip", nil), http.StatusNotFound, "not_found", "")
}

// ADR 003: the tag of another user is not found by any tag operation.
func TestTagOfAnotherUser(t *testing.T) {
	t.Parallel()
	s := newTaggedSetup(t)
	h := s.c.h
	other := h.Login("other@equori.local")
	for _, r := range []apitest.Response{
		h.Call(other, http.MethodGet, "/api/v1/tags/trip", nil),
		h.Call(other, http.MethodPatch, "/api/v1/tags/trip", map[string]string{"name": "mine"}),
		h.Call(other, http.MethodPost, "/api/v1/tags/trip/merge", map[string]string{"into": "travel"}),
		h.Call(other, http.MethodDelete, "/api/v1/tags/trip", nil),
	} {
		h.ExpectProblem(r, http.StatusNotFound, "not_found", "")
	}
	if names := tagNames(t, h); !slices.Equal(names, []string{"travel", "trip"}) {
		t.Fatalf("tags = %v", names)
	}
}
