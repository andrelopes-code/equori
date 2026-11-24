package app

import (
	"encoding/json/jsontext"
	"encoding/json/v2"
	"fmt"
)

// blankContributionAnswers moves a version 34 archive to version 35, where an answer to a question
// with a fact may be blank (migration 00146, CQ2): a stored no to such a question turns null.
func blankContributionAnswers(tables []ArchiveTable) ([]ArchiveTable, error) {
	withFact, err := questionsWithFact(tables)
	if err != nil {
		return nil, err
	}

	return editRows(
		tables,
		"portfolio_contribution_answer",
		func(fields map[string]jsontext.Value) {
			key := string(fields["class_id"]) + string(fields["question_position"])
			if withFact[key] && string(fields["yes"]) == "false" {
				fields["yes"] = jsontext.Value("null")
			}
		},
	)
}

// questionsWithFact holds the class and the position of each question that names a fact.
func questionsWithFact(tables []ArchiveTable) (map[string]bool, error) {
	out := map[string]bool{}

	for _, t := range tables {
		if t.Name != "portfolio_contribution_question" {
			continue
		}

		for i, row := range t.Rows {
			var fields map[string]jsontext.Value
			if err := json.Unmarshal(row, &fields); err != nil {
				return nil, fmt.Errorf("%s row %d: %w", t.Name, i, err)
			}

			if string(fields["fact"]) != "null" {
				out[string(fields["class_id"])+string(fields["position"])] = true
			}
		}
	}

	return out, nil
}
