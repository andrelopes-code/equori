package registry_test

import (
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/registry"
)

func TestRegistry(t *testing.T) {
	if _, err := registry.New("calendar", registry.Entry[int]{ID: "br_banking", Value: 1}, registry.Entry[int]{ID: "br_banking", Value: 2}); err == nil || !strings.Contains(err.Error(), `duplicate calendar "br_banking"`) {
		t.Fatalf("duplicate: %v", err)
	}
	if _, err := registry.New("calendar", registry.Entry[int]{ID: "BR", Value: 1}); err == nil || !strings.Contains(err.Error(), "must match ^[a-z0-9_]{2,40}$") {
		t.Fatalf("malformed: %v", err)
	}
	r, err := registry.New("calendar", registry.Entry[int]{ID: "b_x", Value: 1}, registry.Entry[int]{ID: "a_y", Value: 2})
	if err != nil {
		t.Fatal(err)
	}
	if v, err := r.Get("a_y"); err != nil || v != 2 {
		t.Fatalf("Get(a_y) = %d, %v", v, err)
	}
	if _, err := r.Get("missing"); !errors.Is(err, registry.ErrUnknown) || err.Error() != `unknown calendar "missing"` {
		t.Fatalf("Get(missing) = %v", err)
	}
	if got := r.IDs(); !slices.Equal(got, []string{"a_y", "b_x"}) {
		t.Fatalf("IDs = %v", got)
	}
}
