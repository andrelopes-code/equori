package server_test

import (
	"strings"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/assistant/guide"
)

// TestBRMatrixMatchesArticles keeps the product rows of the regional articles equal to the rows
// of the product matrix, each with the source of its row (assistant parity design, M8).
func TestBRMatrixMatchesArticles(t *testing.T) {
	t.Parallel()

	ids := map[string][]string{}

	for _, row := range apitest.BRProducts() {
		topic := "fixed_income_br"
		if row.Subtype == "tesouro" {
			topic = "government_bonds_br"
		}

		ids[topic] = append(ids[topic], row.ID)

		article, _ := guide.Article(topic)

		line := articleRow(article, row.ID)
		if line == "" {
			t.Errorf("%s has no product row %s", topic, row.ID)
			continue
		}

		if !strings.Contains(row.Source, articleSource(line)) {
			t.Errorf("row %s of %s cites %q, which the matrix source %q does not hold",
				row.ID, topic, articleSource(line), row.Source)
		}
	}

	for topic, want := range ids {
		article, _ := guide.Article(topic)

		for _, line := range strings.Split(article, "\n") {
			id, ok := rowID(line)
			if ok && !contains(want, id) {
				t.Errorf("%s has product row %s, which is not a row of the matrix", topic, id)
			}
		}
	}
}

// articleRow is the table line of the article that starts with the product ID.
func articleRow(article, id string) string {
	for _, line := range strings.Split(article, "\n") {
		if strings.HasPrefix(line, "| "+id+" |") {
			return line
		}
	}

	return ""
}

// articleSource is the first source of the last cell of a product row, the text before a
// semicolon.
func articleSource(line string) string {
	cells := strings.Split(strings.Trim(line, "| "), " | ")
	first, _, _ := strings.Cut(cells[len(cells)-1], ";")

	return strings.TrimSpace(first)
}

func rowID(line string) (string, bool) {
	if !strings.HasPrefix(line, "| ") {
		return "", false
	}

	id, _, _ := strings.Cut(strings.TrimPrefix(line, "| "), " |")
	if len(id) != 4 || id[1] != '-' {
		return "", false
	}

	return id, true
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}

	return false
}
