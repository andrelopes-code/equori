package ingestion_test

import (
	"testing"

	pluggy "github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
)

// A143: a stored record that the aggregator later reports with an institution line id
// stores the id and counts the line as ignored.
func TestA143StoredRecordReceivesItsInstitutionID(t *testing.T) {
	t.Parallel()
	f := newSyncFixture(t)
	f.mapTo(pluggy.SubtypeChecking, f.checking)
	f.line(pluggy.SubtypeChecking, bankLine("tx-1", "2026-11-05", "-10.00"))
	f.sync()

	line := bankLine("tx-1", "2026-11-05", "-10.00")
	line.ProviderID = new("p-1")
	f.line(pluggy.SubtypeChecking, line)
	f.sync()

	var got string
	if err := f.h.Pool.QueryRow(t.Context(), `SELECT institution_id FROM ingestion_external_record WHERE external_id = 'tx-1'`).Scan(&got); err != nil {
		t.Fatal(err)
	}

	if got != "p-1" {
		t.Fatalf("institution_id = %q, want p-1", got)
	}

	if c := f.batches(f.checking)[0].Counts; c.Updated != 0 || c.Ignored != 1 {
		t.Fatalf("counts = %+v, want updated 0 and ignored 1", c)
	}
}
