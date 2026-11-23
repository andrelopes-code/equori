package app

import "encoding/json/jsontext"

// addContributionQuestionLimit moves a version 33 archive to version 34, which adds the nullable
// column limit_value to portfolio_contribution_question (migration 00145, AC15). An earlier
// question has no limit, so every row gains null.
func addContributionQuestionLimit(tables []ArchiveTable) ([]ArchiveTable, error) {
	return withField(
		tables,
		"portfolio_contribution_question",
		"limit_value",
		jsontext.Value("null"),
	)
}
