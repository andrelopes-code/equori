//go:build unix

package pgcluster

import (
	"errors"
	"testing"
)

func TestRefuseRoot(t *testing.T) {
	t.Parallel()
	if !errors.Is(refuseRoot(0), ErrRoot) || refuseRoot(1000) != nil {
		t.Fatal("refuseRoot: want ErrRoot for 0 and nil for 1000")
	}
}
