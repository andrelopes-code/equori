package tool

import (
	"context"
	"errors"
	"slices"
	"testing"
)

// assertFieldError checks that err is an invalid_arguments Error on field.
func assertFieldError(t *testing.T, err error, field string) {
	t.Helper()
	e, ok := errors.AsType[*Error](err)
	if !ok || e.Code != "invalid_arguments" || len(e.Errors) != 1 || e.Errors[0].Field != field {
		t.Errorf("err = %v, want invalid_arguments on %s", err, field)
	}
}

func TestLimit(t *testing.T) {
	t.Parallel()
	for in, want := range map[int]int{0: 20, 1: 1, 50: 50} {
		if got, err := Limit(in); err != nil || got != want {
			t.Errorf("Limit(%d) = %d, %v; want %d", in, got, err, want)
		}
	}
	for _, in := range []int{-1, 51} {
		_, err := Limit(in)
		assertFieldError(t, err, "limit")
	}
}

func TestPaginate(t *testing.T) {
	t.Parallel()
	items := []string{"a", "b", "c", "d", "e"}
	key := func(s string) string { return s }

	var got []string
	cursor := ""
	for range 3 {
		page, next, err := Paginate(items, key, 2, cursor)
		if err != nil {
			t.Fatal(err)
		}
		got = append(got, page...)
		if cursor = next; cursor == "" {
			break
		}
	}
	if !slices.Equal(got, items) || cursor != "" {
		t.Errorf("pages = %v, last cursor %q", got, cursor)
	}

	first, next, _ := Paginate(items, key, 2, "")
	if !slices.Equal(first, []string{"a", "b"}) || next == "" {
		t.Errorf("first page = %v, %q", first, next)
	}
	if page, next, err := Paginate(items, key, 5, ""); err != nil || len(page) != 5 || next != "" {
		t.Errorf("one full page = %v, %q, %v", page, next, err)
	}
	if page, next, err := Paginate([]string{}, key, 2, ""); err != nil || page == nil || len(page) != 0 || next != "" {
		t.Errorf("empty list = %v, %q, %v", page, next, err)
	}

	_, _, err := Paginate(items, key, 2, "bad")
	assertFieldError(t, err, "cursor")
	// A cursor whose item left the list cannot place the next page.
	_, gone, _ := Paginate([]string{"a", "x", "e"}, key, 2, "")
	_, _, err = Paginate(items, key, 2, gone)
	assertFieldError(t, err, "cursor")
}

func TestPageArgsSchema(t *testing.T) {
	t.Parallel()
	type listIn struct {
		Class string `json:"class,omitzero"`
		PageArgs
	}
	tl := New(searchSpec, func(context.Context, int64, listIn) (totalOut, error) { return totalOut{}, nil })
	assertJSON(t, tl.InputSchema(), `{"type":"object","additionalProperties":false,"properties":{
		"class":{"type":"string"},
		"limit":{"type":"integer","description":"items per page, 1 to 50; 20 when absent"},
		"cursor":{"type":"string","description":"next_cursor of the previous page; absent for the first page"}}}`)
}

func TestPageOf(t *testing.T) {
	t.Parallel()
	key := func(s string) string { return s }
	if page, next, err := PageOf([]string{"a", "b"}, key, PageArgs{}); err != nil || len(page) != 2 || next != "" {
		t.Errorf("default page = %v, %q, %v", page, next, err)
	}
	_, _, err := PageOf([]string{"a"}, key, PageArgs{Limit: 51})
	assertFieldError(t, err, "limit")
}
