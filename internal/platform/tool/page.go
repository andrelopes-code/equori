package tool

import "github.com/andrelopes-code/equori/internal/platform/page"

// DefaultLimit and MaxLimit bound the pages of list tools (ADR 012 T11).
const (
	DefaultLimit = 20
	MaxLimit     = 50
)

// Limit returns DefaultLimit for 0, the zero value of an absent limit.
func Limit(n int) (int, error) {
	switch {
	case n == 0:
		return DefaultLimit, nil
	case n < 1 || n > MaxLimit:
		return 0, InvalidArgument("limit", "must be between 1 and 50")
	}
	return n, nil
}

// PageArgs holds the paging arguments of a list tool; the tool's input embeds it.
type PageArgs struct {
	Limit  int    `json:"limit,omitzero" jsonschema:"items per page, 1 to 50; 20 when absent"`
	Cursor string `json:"cursor,omitzero" jsonschema:"next_cursor of the previous page; absent for the first page"`
}

type pageKey struct {
	Key string `json:"k"`
}

// Paginate returns the items after the one the cursor names, at most limit of them, and the
// cursor of the next page, empty on the last page. It pages a list a tool computes in full;
// key identifies an item across calls.
func Paginate[T any](items []T, key func(T) string, limit int, cursor string) ([]T, string, error) {
	start := 0
	if cursor != "" {
		var k pageKey
		if err := page.DecodeCursor(cursor, &k); err != nil {
			return nil, "", invalidCursor()
		}
		i := 0
		for i < len(items) && key(items[i]) != k.Key {
			i++
		}
		if i == len(items) {
			return nil, "", invalidCursor()
		}
		start = i + 1
	}
	end := min(start+limit, len(items))
	out := make([]T, end-start)
	copy(out, items[start:end])
	if end == len(items) {
		return out, "", nil
	}
	next, err := page.EncodeCursor(pageKey{Key: key(items[end-1])})
	return out, next, err
}

func invalidCursor() *Error {
	return InvalidArgument("cursor", "is not a next_cursor of this list, or its item left the list; start again without cursor")
}

// PageOf pages items with the arguments of a list tool.
func PageOf[T any](items []T, key func(T) string, args PageArgs) ([]T, string, error) {
	limit, err := Limit(args.Limit)
	if err != nil {
		return nil, "", err
	}
	return Paginate(items, key, limit, args.Cursor)
}
