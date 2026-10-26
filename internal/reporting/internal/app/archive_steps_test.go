package app

import (
	"errors"
	"slices"
	"strings"
	"testing"
)

// A synthetic step from version 1 to 2 that renames a column of one table (ADR 021, V3).
func renameColumn(tables []ArchiveTable) ([]ArchiveTable, error) {
	out := make([]ArchiveTable, len(tables))
	for i, t := range tables {
		out[i] = ArchiveTable{Name: t.Name, Rows: slices.Clone(t.Rows)}
		if t.Name != "ledger_payee" {
			continue
		}
		for j, row := range t.Rows {
			out[i].Rows[j] = []byte(strings.Replace(string(row), `"label":`, `"name":`, 1))
		}
	}
	return out, nil
}

func TestMigrateArchive(t *testing.T) {
	t.Parallel()
	v1 := []ArchiveTable{
		{Name: "ledger_payee", Rows: [][]byte{[]byte(`{"id":"a","label":"Market"}`)}},
		{Name: "ledger_tag", Rows: [][]byte{[]byte(`{"id":"b","label":"trip"}`)}},
	}
	steps := []ArchiveStep{renameColumn}
	got, err := migrateArchive(v1, 1, steps)
	if err != nil {
		t.Fatal(err)
	}
	if string(got[0].Rows[0]) != `{"id":"a","name":"Market"}` || string(got[1].Rows[0]) != `{"id":"b","label":"trip"}` {
		t.Fatalf("migrated = %s, %s", got[0].Rows[0], got[1].Rows[0])
	}
	if string(v1[0].Rows[0]) != `{"id":"a","label":"Market"}` {
		t.Fatalf("the step changed its input: %s", v1[0].Rows[0])
	}
	same, err := migrateArchive(v1, 2, steps)
	if err != nil || string(same[0].Rows[0]) != `{"id":"a","label":"Market"}` {
		t.Fatalf("an archive of the current version = %s, %v", same[0].Rows[0], err)
	}
	broken := errors.New("broken")
	_, err = migrateArchive(v1, 1, []ArchiveStep{func([]ArchiveTable) ([]ArchiveTable, error) { return nil, broken }})
	if !errors.Is(err, broken) || !strings.Contains(err.Error(), "version 1 to 2") {
		t.Fatalf("a failed step = %v", err)
	}
	if ArchiveVersion != len(archiveSteps)+1 {
		t.Fatalf("ArchiveVersion = %d with %d steps", ArchiveVersion, len(archiveSteps))
	}
}
