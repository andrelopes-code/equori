// Package guide holds the product guide the assistant answers from and the navigation map (spec 9).
package guide

import (
	"embed"
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
)

//go:embed articles/*.md
var articles embed.FS

var topics = []string{
	"getting_started", "accounts_and_categories", "transactions_and_postings", "capture", "credit_cards_and_statements",
	"installments", "foreign_purchases_and_exchange", "refunds_reimbursements_and_disputes", "transfers",
	"imports_and_bank_connections", "categorization_rules_and_payees", "reconciliation", "schedules_and_occurrences",
	"budgets", "goals", "investments", "reports", "privacy_and_the_assistant", "settings_language_and_region",
}

// Topics returns the article topics in the order of the get_help declaration.
func Topics() []string { return slices.Clone(topics) }

// Article returns the Markdown text of a topic.
func Article(topic string) (string, bool) {
	if !slices.Contains(topics, topic) {
		return "", false
	}
	b, err := articles.ReadFile("articles/" + topic + ".md")
	return string(b), err == nil
}

// Screen is one entry of the navigation map.
type Screen struct {
	Path   string   `json:"path"`
	Topics []string `json:"topics"`
	Screen string   `json:"screen"`
	Tasks  []string `json:"tasks"`
}

var pathPattern = regexp.MustCompile(`^/[a-zA-Z0-9/$_-]*$`)

// ParseMap decodes the navigation map and rejects an unknown topic or a malformed path.
func ParseMap(b []byte) ([]Screen, error) {
	var screens []Screen
	if err := json.Unmarshal(b, &screens); err != nil {
		return nil, fmt.Errorf("parse navigation map: %w", err)
	}
	for _, s := range screens {
		if !pathPattern.MatchString(s.Path) {
			return nil, fmt.Errorf("navigation map: path %q does not match %s", s.Path, pathPattern)
		}
		for _, topic := range s.Topics {
			if !slices.Contains(topics, topic) {
				return nil, fmt.Errorf("navigation map: path %s has unknown topic %q", s.Path, topic)
			}
		}
	}
	return screens, nil
}
