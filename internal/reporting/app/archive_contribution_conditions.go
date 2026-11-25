package app

import "encoding/json/jsontext"

// addContributionConditions moves a version 35 archive to version 36, which adds the revision of
// the plan, the effect and reminder of a question, the date and override of an answer and the
// release of a member (migration 00156, CO1, CO3, CO7, CO8, CO15). An earlier row takes the
// default of its column.
func addContributionConditions(tables []ArchiveTable) ([]ArchiveTable, error) {
	columns := []struct {
		table, field string
		value        jsontext.Value
	}{
		{"portfolio_contribution_plan", "revision", jsontext.Value("1")},
		{"portfolio_contribution_question", "effect", jsontext.Value(`"weigh"`)},
		{"portfolio_contribution_question", "review_months", jsontext.Value("0")},
		{"portfolio_contribution_answer", "answered_on", jsontext.Value("null")},
		{"portfolio_contribution_answer", "overrides", jsontext.Value("false")},
		{"portfolio_contribution_member", "release_month", jsontext.Value("null")},
	}

	var err error
	for _, c := range columns {
		if tables, err = withField(tables, c.table, c.field, c.value); err != nil {
			return nil, err
		}
	}

	return tables, nil
}
