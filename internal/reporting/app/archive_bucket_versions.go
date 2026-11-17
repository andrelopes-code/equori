package app

import (
	"bytes"
	"encoding/json/jsontext"
	"encoding/json/v2"
	"fmt"
	"slices"
	"time"

	"github.com/google/uuid"
)

const (
	bucketTable         = "planning_bucket"
	bucketCategoryTable = "planning_bucket_category"
	bucketMethodTable   = "planning_bucket_method"
)

// addBuckets moves a version 16 archive to version 17, which adds planning_bucket and
// planning_bucket_category (migration 00101). Version 16 has no bucket rows, so every table
// carries over unchanged.
func addBuckets(tables []ArchiveTable) ([]ArchiveTable, error) {
	out := make([]ArchiveTable, len(tables))
	for i, t := range tables {
		out[i] = ArchiveTable{Name: t.Name, Rows: slices.Clone(t.Rows)}
	}

	return out, nil
}

// addBucketDirections writes false into at_least and takes_goals of every version 17 row of
// planning_bucket (migration 00102): a bucket saved before keeps its target as a ceiling and draws
// no goal deposits (income buckets A234).
func addBucketDirections(tables []ArchiveTable) ([]ArchiveTable, error) {
	tables, err := withField(tables, "planning_bucket", "at_least", jsontext.Value("false"))
	if err != nil {
		return nil, err
	}

	return withField(tables, "planning_bucket", "takes_goals", jsontext.Value("false"))
}

// addBucketVersions moves a version 24 archive to version 25, which keeps one bucket method per
// start month (migration 00111, income split versions A240, A241). The buckets of the archive
// become one version that starts in the month of the earliest bucket row; each bucket keeps its
// id as lineage_id. An archive without buckets, or one written after the migration, carries over
// unchanged.
func addBucketVersions(tables []ArchiveTable) ([]ArchiveTable, error) {
	at := slices.IndexFunc(tables, func(t ArchiveTable) bool { return t.Name == bucketTable })
	versioned := slices.ContainsFunc(tables, func(t ArchiveTable) bool {
		return t.Name == bucketMethodTable
	})

	if at < 0 || len(tables[at].Rows) == 0 || versioned {
		return editRows(tables, "", nil)
	}

	from, err := firstBucketMonth(tables[at].Rows)
	if err != nil {
		return nil, err
	}

	start := jsontext.Value(`"` + from + `"`)

	out, err := editRows(tables, bucketTable, func(fields map[string]jsontext.Value) {
		fields["effective_from"], fields["lineage_id"] = start, fields["id"]
	})
	if err != nil {
		return nil, err
	}

	out, err = withField(out, bucketCategoryTable, "effective_from", start)
	if err != nil {
		return nil, err
	}

	method := ArchiveTable{
		Name: bucketMethodTable,
		Rows: [][]byte{[]byte(`{"effective_from":` + string(start) + `}`)},
	}

	return slices.Insert(out, at, method), nil
}

// firstBucketMonth returns the first day of the UTC month of the earliest bucket row: the
// timestamp of the smallest id when it is a UUIDv7, else 1970-01-01.
func firstBucketMonth(rows [][]byte) (string, error) {
	var first uuid.UUID

	for i, row := range rows {
		var fields struct {
			ID uuid.UUID `json:"id"`
		}
		if err := json.Unmarshal(row, &fields); err != nil {
			return "", fmt.Errorf("%s row %d: %w", bucketTable, i, err)
		}

		if i == 0 || bytes.Compare(fields.ID[:], first[:]) < 0 {
			first = fields.ID
		}
	}

	at := time.Unix(0, 0)
	if first.Version() == 7 {
		at = time.Unix(first.Time().UnixTime())
	}

	at = at.UTC()

	return time.Date(at.Year(), at.Month(), 1, 0, 0, 0, 0, time.UTC).Format(time.DateOnly), nil
}
