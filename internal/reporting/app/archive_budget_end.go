package app

import "encoding/json/jsontext"

// addBudgetEnded moves a version 36 archive to version 37, which adds ended to
// planning_budget_amount (migration 00159, budget end E1). No earlier version ended a budget.
func addBudgetEnded(tables []ArchiveTable) ([]ArchiveTable, error) {
	return withField(tables, "planning_budget_amount", "ended", jsontext.Value("false"))
}
