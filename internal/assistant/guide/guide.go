// Package guide holds the product guide the assistant answers from and the navigation map (spec 9).
package guide

import (
	"embed"
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
	"strings"
)

//go:embed articles/*.md
var articles embed.FS

var topics = []string{
	"getting_started",
	"accounts_and_categories",
	"transactions_and_postings",
	"capture",
	"credit_cards_and_statements",
	"installments",
	"foreign_purchases_and_exchange",
	"refunds_reimbursements_and_disputes",
	"transfers",
	"imports_and_bank_connections",
	"categorization_rules_and_payees",
	"reconciliation",
	"schedules_and_occurrences",
	"budgets",
	"income_split",
	"goals",
	"investments",
	"investment_operations",
	"fixed_income",
	"fixed_income_payments",
	"investment_income",
	"investments_br",
	"contribution_plan",
	"reports",
	"privacy_and_the_assistant",
	"settings_language_and_region",
}

// summaries says, per topic, what its article answers; the model picks the topic from them.
var summaries = map[string]string{
	"getting_started":                     "first steps and what each area of the app is for",
	"accounts_and_categories":             "accounts, categories, institutions and their tools",
	"transactions_and_postings":           "recording, changing, categorizing and voiding",
	"capture":                             "typing several transactions as text",
	"credit_cards_and_statements":         "cards, limits, cycles, statements and payments",
	"installments":                        "purchases in installments",
	"foreign_purchases_and_exchange":      "other currencies and exchanges",
	"refunds_reimbursements_and_disputes": "refunds, reimbursements and disputes",
	"transfers":                           "money between own accounts",
	"imports_and_bank_connections":        "statement files, bank links and their review",
	"categorization_rules_and_payees":     "rules, payees, aliases and tags",
	"reconciliation":                      "checking a balance against the institution",
	"schedules_and_occurrences":           "recurring bills, income and subscriptions",
	"budgets":                             "monthly budgets and the budget plan",
	"income_split":                        "income divided into buckets",
	"goals":                               "savings goals and shared accounts",
	"investments":                         "brokerages, trades, prices and the portfolio",
	"investment_operations":               "notes, corporate actions, custody and day trades",
	"fixed_income":                        "contracts, rates, terms and applications",
	"fixed_income_payments":               "coupons, amortization, maturity and redemption",
	"investment_income":                   "dividends and other income of holdings",
	"investments_br":                      "Brazil: products, tax, guarantee and codes",
	"contribution_plan":                   "target split and where a contribution goes",
	"reports":                             "cash and accrual views, indicators, net worth",
	"privacy_and_the_assistant":           "privacy mode and what the assistant does not do",
	"settings_language_and_region":        "language, region, base currency, members, export",
}

// Index returns one line per topic, the topic and what its article answers, in topic order.
func Index() string {
	var b strings.Builder
	for _, topic := range topics {
		b.WriteString(topic + ": " + summaries[topic] + "\n")
	}

	return b.String()
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
				return nil, fmt.Errorf(
					"navigation map: path %s has unknown topic %q",
					s.Path,
					topic,
				)
			}
		}
	}

	return screens, nil
}
