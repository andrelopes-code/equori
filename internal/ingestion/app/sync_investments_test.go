package app

import (
	"testing"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

// plainAggregator has no InvestmentReader; a call to any other method panics.
type plainAggregator struct{ Aggregator }

// S543: an aggregator without InvestmentReader reads and stores no investment (R2). The zero
// Service holds no repository, so a read or a store panics.
func TestSyncInvestmentsWithoutReader_S543(t *testing.T) {
	t.Parallel()

	var s Service

	if err := s.syncInvestments(
		t.Context(),
		plainAggregator{},
		&domain.Connection{},
		domain.Credentials{},
	); err != nil {
		t.Fatal(err)
	}
}
