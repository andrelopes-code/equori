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
	"fixed_income_br",
	"government_bonds_br",
	"equities_br",
	"funds_br",
	"contribution_plan",
	"reports",
	"privacy_and_the_assistant",
	"settings_language_and_region",
}

// summaries says, per topic, what its article answers; the model picks the topic from them.
//
//nolint:gosec // G101 reads the topic summaries as credentials; they are guide text
var summaries = map[string]string{
	"getting_started":                     "first steps and the areas of the app",
	"accounts_and_categories":             "accounts, categories, institutions",
	"transactions_and_postings":           "recording, changing, categorizing, voiding",
	"capture":                             "several transactions as text",
	"credit_cards_and_statements":         "cards, limits, cycles, statements, payments",
	"installments":                        "installment purchases",
	"foreign_purchases_and_exchange":      "other currencies, exchanges",
	"refunds_reimbursements_and_disputes": "refunds, reimbursements, disputes",
	"transfers":                           "between own accounts",
	"imports_and_bank_connections":        "statement files, bank links",
	"categorization_rules_and_payees":     "rules, payees, tags",
	"reconciliation":                      "checking a balance against the bank",
	"schedules_and_occurrences":           "recurring bills, income, subscriptions",
	"budgets":                             "monthly budgets, budget plan",
	"income_split":                        "income buckets",
	"goals":                               "savings goals, shared accounts",
	"investments":                         "brokerages, trades, prices, portfolio",
	"investment_operations":               "notes, corporate actions, custody",
	"fixed_income":                        "contracts, rates, terms, applications",
	"fixed_income_payments":               "coupons, maturity, redemption",
	"investment_income":                   "dividends and other holding income",
	"investments_br":                      "Brazil: product index, tax year",
	"fixed_income_br":                     "Brazil: CDB, LCI, LCA: tax, FGC",
	"government_bonds_br":                 "Brazil: Tesouro Direto, tax",
	"equities_br":                         "Brazil: stocks, FII, ETF: tax",
	"funds_br":                            "Brazil: open funds, come-cotas",
	"contribution_plan":                   "target split of a contribution",
	"reports":                             "views, indicators, net worth",
	"privacy_and_the_assistant":           "privacy mode and assistant limits",
	"settings_language_and_region":        "language, region, currency, members",
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
