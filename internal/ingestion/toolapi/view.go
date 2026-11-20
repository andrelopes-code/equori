package toolapi

import (
	"cmp"
	"encoding/json"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/view"
)

type importBatch struct {
	BatchID     string `json:"batch_id"`
	Account     string `json:"account"`
	Source      string `json:"source"`
	FileName    string `json:"file_name,omitempty"`
	StartedAt   string `json:"started_at"`
	Created     int64  `json:"created"`
	Matched     int64  `json:"matched"`
	NeedsReview int64  `json:"needs_review"`
	Ignored     int64  `json:"ignored"`
}

type importsData struct {
	Batches []importBatch `json:"batches"`
	Review  int64         `json:"review"`
}

// Views returns the builders of the ingestion reads (answer views design, V3).
func Views() map[view.Key]view.Builder {
	return map[view.Key]view.Builder{
		{Tool: "get_imports", Form: "imports"}: importsFormView,
	}
}

// importsFormView lists the import batches, newest first as the read gives them, with what each
// line became and what waits for review.
func importsFormView(outputs []json.RawMessage, _ view.Select, _ time.Time) (view.Payload, error) {
	var out getImportsOut
	if err := json.Unmarshal(outputs[0], &out); err != nil {
		return view.Payload{}, fmt.Errorf("decode get_imports output: %w", err)
	}

	data := importsData{Batches: []importBatch{}}
	for _, b := range out.Batches {
		batch := batchOf(b)
		data.Batches = append(data.Batches, batch)
		data.Review += batch.NeedsReview
	}

	return view.Payload{
		Title:   view.Text{Key: "assistantView.imports.title"},
		Verdict: importsVerdict(data),
		Open:    &view.Link{Screen: "/imports"},
		Rows:    importsRows(data.Batches),
		Data:    data,
	}, nil
}

func batchOf(b batchView) importBatch {
	return importBatch{
		BatchID:     b.BatchID,
		Account:     cmp.Or(b.AccountName, b.Source),
		Source:      b.Source,
		FileName:    b.FileName,
		StartedAt:   b.StartedAt,
		Created:     int64(b.Counts.Created),
		Matched:     int64(b.Counts.Matched),
		NeedsReview: int64(b.Counts.NeedsReview),
		Ignored:     int64(b.Counts.Ignored),
	}
}

func importsVerdict(d importsData) view.Text {
	if len(d.Batches) == 0 {
		return view.Text{Key: "assistantView.imports.empty"}
	}

	return view.Text{Key: "assistantView.imports.verdict", Params: map[string]view.Value{
		"count":  view.CountValue(int64(len(d.Batches))),
		"review": view.CountValue(d.Review),
	}}
}

func importsRows(batches []importBatch) view.Table {
	t := view.Table{
		Head: []string{
			"assistantView.col.account",
			"assistantView.col.created",
			"assistantView.col.review",
		},
		Rows: [][]view.Value{},
	}
	for _, b := range batches {
		t.Rows = append(t.Rows, []view.Value{
			view.TextValue(b.Account), view.CountValue(b.Created), view.CountValue(b.NeedsReview),
		})
	}

	return t
}
