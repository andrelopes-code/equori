package app

import "fmt"

// ArchiveVersion is the archive_version this instance writes and the highest it reads
// (ADR 021). It is the number of steps in archiveSteps plus 1.
const ArchiveVersion = 1

// ArchiveStep migrates the tables of an archive from one version to the next; it is pure and
// leaves its input unchanged (ADR 021, V3).
type ArchiveStep func([]ArchiveTable) ([]ArchiveTable, error)

// archiveSteps holds at index i the step from version i+1 to i+2. A change to an exported
// table appends its step here and increments ArchiveVersion in the same commit (ADR 021, V2).
var archiveSteps = []ArchiveStep{}

// migrateArchive applies the steps from version from to the last one, in order.
func migrateArchive(tables []ArchiveTable, from int, steps []ArchiveStep) ([]ArchiveTable, error) {
	for v := from; v <= len(steps); v++ {
		var err error
		if tables, err = steps[v-1](tables); err != nil {
			return nil, fmt.Errorf("migrate archive from version %d to %d: %w", v, v+1, err)
		}
	}
	return tables, nil
}
