//go:build unix

package main

import (
	"errors"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/winsvc"
)

// W-S5: equori service manages the Windows service only.
func TestServiceCommandElsewhere(t *testing.T) {
	t.Parallel()
	if err := serviceCommand([]string{"install"}); !errors.Is(err, winsvc.ErrUnsupported) {
		t.Fatalf("serviceCommand(install) = %v, want winsvc.ErrUnsupported", err)
	}
}
