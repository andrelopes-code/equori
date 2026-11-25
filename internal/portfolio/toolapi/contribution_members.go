package toolapi

import (
	"time"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

type contributionMemberOut struct {
	AccountID    string                   `json:"account_id,omitzero"`
	Instrument   string                   `json:"instrument,omitzero"`
	TargetBP     int                      `json:"target_bp,omitzero"`
	Value        tool.Money               `json:"value"`
	ShareBP      int                      `json:"share_bp,omitzero"`
	AfterShareBP int                      `json:"after_share_bp,omitzero"`
	UnitValue    tool.Money               `json:"unit_value,omitzero"`
	Amount       tool.Money               `json:"amount,omitzero"`
	Quantity     tool.Money               `json:"quantity,omitzero"       jsonschema:"units to buy, an estimate at the prices of today"`
	Cost         tool.Money               `json:"cost,omitzero"           jsonschema:"cost of the order in the base currency, never above amount"`
	Answers      []bool                   `json:"answers,omitzero"        jsonschema:"one answer per question of the group, true for yes"`
	BlankAnswers []int                    `json:"blank_answers,omitzero"  jsonschema:"0-based positions of answers left blank"`
	FactAnswers  []string                 `json:"fact_answers,omitzero"   jsonschema:"per question: yes or no from the filings, none when the investor's answer applies; blank: an equal share"`
	FactDetails  []contributionFactDetail `json:"fact_details,omitzero"   jsonschema:"per question: the figure the answer read and its date, or the reason it has none"`
	FactsYear    string                   `json:"facts_year,omitzero"     jsonschema:"last day of the fiscal year the fact answers read"`

	AnswerDates     []string   `json:"answer_dates,omitzero"     jsonschema:"day of each answer"`
	AnswerOverrides []int      `json:"answer_overrides,omitzero" jsonschema:"0-based positions of overridden facts"`
	Released        bool       `json:"released,omitzero"         jsonschema:"freed for this month"`
	Held            bool       `json:"held,omitzero"             jsonschema:"held"`
	HeldBy          []int      `json:"held_by,omitzero"          jsonschema:"0-based hold criteria answered no"`
	WarnedBy        []int      `json:"warned_by,omitzero"        jsonschema:"0-based warn criteria answered no"`
	Due             []int      `json:"due,omitzero"              jsonschema:"0-based questions due for review"`
	Forgone         tool.Money `json:"forgone,omitzero"          jsonschema:"amount given up by a hold, in a preview"`
}

type contributionFactDetail struct {
	Value  string    `json:"value,omitzero"`
	Reason string    `json:"reason,omitzero"`
	Date   tool.Date `json:"date,omitzero"`
}

func contributionMemberOf(m app.ContributionMember) contributionMemberOut {
	return contributionMemberOut{
		AccountID:    idText(m.AccountID),
		Instrument:   string(m.Instrument),
		TargetBP:     valueOf(m.TargetBP),
		Value:        tool.MoneyOf(m.Value),
		ShareBP:      valueOf(m.ShareBP),
		AfterShareBP: valueOf(m.AfterShareBP),
		UnitValue:    optionalMoney(m.UnitValue),
		Amount:       optionalMoney(m.Amount),
		Quantity:     optionalMoney(m.Quantity),
		Cost:         optionalMoney(m.Cost),
		Answers:      answersOf(m.Answers),
		BlankAnswers: blanksOf(m.Answers),
		FactAnswers:  factAnswersOf(m.FactAnswers),
		FactDetails:  factDetailsOf(m.FactDetails),
		FactsYear:    factsYearOf(m.FactsYear),

		AnswerDates:     answerDatesOf(m.AnswerDates),
		AnswerOverrides: positionsOf(m.AnswerOverrides),
		Released:        m.Released,
		Held:            m.Held,
		HeldBy:          m.HeldBy,
		WarnedBy:        m.WarnedBy,
		Due:             m.Due,
		Forgone:         optionalMoney(m.Forgone),
	}
}

// answerDatesOf writes no date as an empty string and no list when every entry is empty.
func answerDatesOf(in []*time.Time) []string {
	out := make([]string, len(in))
	empty := true

	for i, d := range in {
		if d != nil {
			out[i] = d.Format(time.DateOnly)
			empty = false
		}
	}

	if empty {
		return nil
	}

	return out
}

func positionsOf(in []bool) []int {
	var out []int

	for i, on := range in {
		if on {
			out = append(out, i)
		}
	}

	return out
}

// answersOf writes a blank answer as false; blanksOf names it.
func answersOf(in []*bool) []bool {
	if len(in) == 0 {
		return nil
	}

	out := make([]bool, len(in))
	for i, a := range in {
		out[i] = a != nil && *a
	}

	return out
}

func blanksOf(in []*bool) []int {
	var out []int

	for i, a := range in {
		if a == nil {
			out = append(out, i)
		}
	}

	return out
}

func factAnswersOf(in []domain.FactAnswer) []string {
	if len(in) == 0 {
		return nil
	}

	out := make([]string, len(in))
	for i, a := range in {
		out[i] = string(a)
	}

	return out
}

func factDetailsOf(in []domain.FactDetail) []contributionFactDetail {
	if len(in) == 0 {
		return nil
	}

	out := make([]contributionFactDetail, len(in))
	for i, d := range in {
		out[i] = contributionFactDetail{Value: d.Value, Reason: d.Reason}
		if d.Date != nil {
			out[i].Date = tool.DateOf(*d.Date)
		}
	}

	return out
}

func factsYearOf(t *time.Time) string {
	if t == nil {
		return ""
	}

	return t.Format(time.DateOnly)
}
