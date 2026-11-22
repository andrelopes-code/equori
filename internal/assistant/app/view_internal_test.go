package app

import (
	"errors"
	"fmt"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
)

func TestTurnStateReads(t *testing.T) {
	var ts turnState

	for i := 1; i <= maxReads; i++ {
		h, ok := ts.addRead("get_help", nil, []byte(`{}`))
		if !ok || h != fmt.Sprintf("r%d", i) {
			t.Fatalf("read %d: handle %q, ok %v", i, h, ok)
		}
	}

	if _, ok := ts.addRead("get_help", nil, []byte(`{}`)); ok {
		t.Fatalf("read %d got a handle", maxReads+1)
	}

	tool, out, ok := ts.read("r2")
	if !ok || tool != "get_help" || string(out) != `{}` {
		t.Fatalf("read r2 = %q %q %v", tool, out, ok)
	}

	if _, _, ok := ts.read("r99"); ok {
		t.Fatal("unknown handle resolved")
	}
}

func TestTurnStateReadTooLarge(t *testing.T) {
	var ts turnState

	if _, ok := ts.addRead("get_help", nil, make([]byte, maxReadBytes+1)); ok {
		t.Fatal("an output above the limit got a handle")
	}

	if h, ok := ts.addRead("get_help", nil, make([]byte, maxReadBytes)); !ok || h != "r1" {
		t.Fatalf("an output at the limit: handle %q, ok %v", h, ok)
	}
}

func TestTurnStateViews(t *testing.T) {
	var ts turnState

	for i := range maxViews {
		if err := ts.addView(domain.View{ID: uuid.New(), Form: "help"}); err != nil {
			t.Fatalf("view %d: %v", i+1, err)
		}
	}

	err := ts.addView(domain.View{ID: uuid.New(), Form: "help"})
	if !errors.Is(err, domain.ErrTooManyViews) {
		t.Fatalf("view %d: err %v, want ErrTooManyViews", maxViews+1, err)
	}

	views := ts.takeViews()
	if len(views) != maxViews || views[0].Seq != 0 || views[2].Seq != 2 {
		t.Fatalf("takeViews = %+v", views)
	}

	if len(ts.takeViews()) != 0 {
		t.Fatal("takeViews kept the views")
	}
}
