// Package registry holds an immutable set of implementations keyed by identifier.
package registry

import (
	"errors"
	"fmt"
	"slices"
)

var ErrUnknown = errors.New("unknown")

type Entry[T any] struct {
	ID    string
	Value T
}

type Registry[T any] struct {
	kind    string
	values  map[string]T
	sortedS []string
}

// New builds a registry of the given kind, rejecting malformed and duplicate identifiers.
func New[T any](kind string, entries ...Entry[T]) (Registry[T], error) {
	r := Registry[T]{kind: kind, values: make(map[string]T, len(entries))}
	for _, e := range entries {
		if !ValidID(e.ID) {
			return Registry[T]{}, fmt.Errorf("%s id %q must match %s", kind, e.ID, IDPattern)
		}

		if _, dup := r.values[e.ID]; dup {
			return Registry[T]{}, fmt.Errorf("duplicate %s %q", kind, e.ID)
		}

		r.values[e.ID] = e.Value
		r.sortedS = append(r.sortedS, e.ID)
	}

	slices.Sort(r.sortedS)

	return r, nil
}

func (r Registry[T]) Get(id string) (T, error) {
	v, ok := r.values[id]
	if !ok {
		var zero T
		return zero, fmt.Errorf("%w %s %q", ErrUnknown, r.kind, id)
	}

	return v, nil
}

// IDs returns the identifiers in ascending order as a new slice.
func (r Registry[T]) IDs() []string {
	return slices.Clone(r.sortedS)
}
