package marketdata

import (
	"slices"
	"testing"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
)

func TestBusinessDayIndexes(t *testing.T) {
	got := businessDayIndexes()

	// Coverage row F-21: the dollar index compounds by business day.
	if want := (domain.BusinessDayIndexes{"cdi", "selic", "usd_brl"}); !slices.Equal(got, want) {
		t.Fatalf("businessDayIndexes() = %v, want %v", got, want)
	}
}
