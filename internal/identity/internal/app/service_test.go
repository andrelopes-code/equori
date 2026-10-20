package app

import (
	"context"
	"errors"
	"testing"
)

func TestAcquireHashSlotWhenFull(t *testing.T) {
	t.Parallel()
	s := &Service{hashSlots: make(chan struct{}, 1)}
	release, err := s.acquireHashSlot(t.Context())
	if err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, err := s.acquireHashSlot(ctx); !errors.Is(err, ErrBusy) {
		t.Fatalf("err = %v, want ErrBusy while the only slot is taken", err)
	}

	release()
	if _, err := s.acquireHashSlot(t.Context()); err != nil {
		t.Fatalf("slot not reusable after release: %v", err)
	}
}
