package app

// addContributionQuestions moves a version 28 archive to version 29, which adds
// portfolio_contribution_question and portfolio_contribution_answer (migration 00124). An earlier
// archive holds no row of them, so the step leaves every table unchanged (contribution questions
// CQ4).
func addContributionQuestions(tables []ArchiveTable) ([]ArchiveTable, error) {
	return tables, nil
}
