package marketdata

import (
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/marketdata/internal/domain"
)

func TestBusinessDayIndexes(t *testing.T) {
	got := businessDayIndexes()

	if want := (domain.BusinessDayIndexes{"cdi"}); !slices.Equal(got, want) {
		t.Fatalf("businessDayIndexes() = %v, want %v", got, want)
	}
}
