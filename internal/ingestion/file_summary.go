package ingestion

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"strings"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/ingestion/ofx"
)

// summaryRows is how many lines of a csv file the model reads (assistant parity design, F4).
const summaryRows = 12

// FileSummary describes a statement file for a language model without its values: of an ofx file
// the line count, the period and the currency, of a csv file the header and up to 12 lines masked
// as a column suggestion masks them (F4). Another kind has no summary.
func FileSummary(kind string, content []byte) string {
	switch kind {
	case "ofx":
		return ofxSummary(content)
	case "csv":
		return csvSummary(content)
	}

	return ""
}

func ofxSummary(content []byte) string {
	// The scale only rounds amounts, which the summary does not show.
	st, err := ofx.Parse(content, 2)
	if err != nil {
		return "OFX statement that could not be read."
	}

	s := fmt.Sprintf("OFX statement: %d lines", len(st.Records))
	if st.From != nil && st.To != nil {
		s += fmt.Sprintf(" from %s to %s", st.From.Format("2006-01-02"), st.To.Format("2006-01-02"))
	}

	if st.Currency != "" {
		s += ", currency " + st.Currency
	}

	return s + "."
}

func csvSummary(content []byte) string {
	delimiter := csvDelimiter(content)

	r := csv.NewReader(bytes.NewReader(content))
	r.Comma = delimiter
	r.FieldsPerRecord = -1
	r.LazyQuotes = true

	rows, err := r.ReadAll()
	if err != nil || len(rows) == 0 {
		return "CSV file that could not be read."
	}

	sample := domain.MaskSample(domain.ColumnSample{
		Header: rows[0],
		Rows:   rows[1:min(len(rows), summaryRows+1)],
	})

	lines := []string{
		fmt.Sprintf(
			"CSV file, delimiter %q, header and %d of %d lines, digits as 9 and letters as A:",
			string(delimiter),
			len(sample.Rows),
			len(rows)-1,
		),
		strings.Join(sample.Header, string(delimiter)),
	}
	for _, row := range sample.Rows {
		lines = append(lines, strings.Join(row, string(delimiter)))
	}

	return strings.Join(lines, "\n")
}

// csvDelimiter is the delimiter the first line holds most of.
func csvDelimiter(content []byte) rune {
	first, _, _ := bytes.Cut(content, []byte("\n"))

	best, count := ',', 0
	for _, d := range []rune{';', '\t', ','} {
		if n := bytes.Count(first, []byte(string(d))); n > count {
			best, count = d, n
		}
	}

	return best
}
