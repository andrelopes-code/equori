package app

import (
	"testing"

	"github.com/google/uuid"
)

func TestResolveRefs(t *testing.T) {
	t.Parallel()

	id := uuid.MustParse("11111111-1111-1111-1111-111111111111")

	tests := []struct {
		name        string
		args        string
		refs        map[string]string
		result      string
		want        string
		wantMissing string
	}{
		{
			name: "default pointer",
			args: `{"id_ref":"x"}`, refs: map[string]string{"/id_ref": id.String()},
			result: `{"id":"42"}`, want: `{"id_ref":"42"}`,
		},
		{
			name: "nested object",
			args: `{"a":{"b":"x"}}`, refs: map[string]string{"/a/b": id.String() + "#/data/id"},
			result: `{"data":{"id":"7"}}`, want: `{"a":{"b":"7"}}`,
		},
		{
			name: "array index in args and result",
			args: `{"items":["x","y"]}`, refs: map[string]string{"/items/1": id.String() + "#/ids/0"},
			result: `{"ids":["a","b"]}`, want: `{"items":["x","a"]}`,
		},
		{
			name:   "escaped key",
			args:   `{"a/b":"x","c~d":"y"}`,
			refs:   map[string]string{"/a~1b": id.String(), "/c~0d": id.String() + "#/k~1l"},
			result: `{"id":"1","k/l":"2"}`, want: `{"a/b":"1","c~d":"2"}`,
		},
		{
			name: "number stays a number",
			args: `{"n":"x"}`, refs: map[string]string{"/n": id.String()},
			result: `{"id":12345678901234567890}`, want: `{"n":12345678901234567890}`,
		},
		{
			name: "missing result pointer",
			args: `{"a":"x","b":"y"}`, refs: map[string]string{"/a": id.String() + "#/nope", "/b": id.String()},
			result: `{"id":"1"}`, wantMissing: "/a",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, missing, err := resolveRefs([]byte(tt.args), tt.refs, map[uuid.UUID][]byte{id: []byte(tt.result)})
			if err != nil {
				t.Fatal(err)
			}

			if missing != tt.wantMissing || string(got) != tt.want && tt.wantMissing == "" {
				t.Fatalf("got %s, missing %q; want %s, missing %q", got, missing, tt.want, tt.wantMissing)
			}
		})
	}
}

func TestHasPointer(t *testing.T) {
	t.Parallel()

	doc := []byte(`{"a":{"b":[1,{"c":null}]},"x/y":1}`)

	tests := []struct {
		pointer string
		want    bool
	}{
		{"/a/b/0", true},
		{"/a/b/1/c", true},
		{"/x~1y", true},
		{"/a/b/2", false},
		{"/a/z", false},
		{"/a/b/01", false},
		{"a", false},
	}
	for _, tt := range tests {
		if got := hasPointer(doc, tt.pointer); got != tt.want {
			t.Errorf("hasPointer(%q) = %v, want %v", tt.pointer, got, tt.want)
		}
	}
}
