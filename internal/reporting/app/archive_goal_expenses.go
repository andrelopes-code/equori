package app

// addGoalExpenses moves a version 26 archive to version 27, which adds planning_goal_expense
// (migration 00117). An earlier archive holds no row of it, so the step leaves every table
// unchanged (planning coherence A256).
func addGoalExpenses(tables []ArchiveTable) ([]ArchiveTable, error) {
	return tables, nil
}
