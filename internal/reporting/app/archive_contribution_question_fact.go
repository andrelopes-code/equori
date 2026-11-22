package app

import "encoding/json/jsontext"

// addContributionQuestionFact moves a version 31 archive to version 32, which adds the nullable
// column fact to portfolio_contribution_question (migration 00141, FQ9). An earlier question
// names no fact, so every row gains null.
func addContributionQuestionFact(tables []ArchiveTable) ([]ArchiveTable, error) {
	return withField(tables, "portfolio_contribution_question", "fact", jsontext.Value("null"))
}
