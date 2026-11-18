package app

import "encoding/json/jsontext"

// addGoalExpenses moves a version 26 archive to version 27, which adds planning_goal_expense
// (migration 00117). An earlier archive holds no row of it, so the step leaves every table
// unchanged (planning coherence A256).
func addGoalExpenses(tables []ArchiveTable) ([]ArchiveTable, error) {
	return tables, nil
}

// addGoalAllocations moves a version 27 archive to version 28 (migration 00118): every row of
// planning_goal_account gets allocated false, since a goal saved before holds its accounts
// whole, and every row of planning_schedule gets goal_id null. planning_goal_allocation has no
// row in an earlier archive (planning coherence A255).
func addGoalAllocations(tables []ArchiveTable) ([]ArchiveTable, error) {
	tables, err := withField(tables, "planning_goal_account", "allocated", jsontext.Value("false"))
	if err != nil {
		return nil, err
	}

	return withField(tables, "planning_schedule", "goal_id", jsontext.Value("null"))
}
