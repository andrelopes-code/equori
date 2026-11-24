package toolapi

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

// contributionView is the contribution plan valued at today. A field of a figure that is not
// computed is absent: no share, drift or amount while status is incomplete, and no amount,
// total_after or drift_after_bp without an amount input. A basis-point figure of zero is absent.
type contributionView struct {
	Status       string                 `json:"status"                  jsonschema:"complete, or incomplete when missing is not empty"`
	Amount       tool.Money             `json:"amount,omitzero"`
	Total        tool.Money             `json:"total"`
	TotalAfter   tool.Money             `json:"total_after,omitzero"`
	DriftBP      int                    `json:"drift_bp,omitzero"`
	DriftAfterBP int                    `json:"drift_after_bp,omitzero"`
	Leftover     tool.Money             `json:"leftover,omitzero"       jsonschema:"amount no order can take, in the base currency; present with an amount input and status complete"`
	Classes      []contributionClassOut `json:"classes"`
	Outside      []contributionOutside  `json:"outside"                 jsonschema:"holdings and accounts that belong to no member"`
	Missing      []contributionMissing  `json:"missing"                 jsonschema:"holdings and accounts without a price or a rate"`

	GuaranteeName string `json:"guarantee_name,omitzero" jsonschema:"deposit guarantee scheme of the base currency, such as FGC"`
}

type contributionClassOut struct {
	Name         string                   `json:"name"`
	TargetBP     int                      `json:"target_bp"`
	Value        tool.Money               `json:"value"`
	ShareBP      int                      `json:"share_bp,omitzero"`
	AfterShareBP int                      `json:"after_share_bp,omitzero"`
	Amount       tool.Money               `json:"amount,omitzero"`
	Cost         tool.Money               `json:"cost,omitzero"           jsonschema:"order cost of a class whose members have no targets"`
	Members      []contributionMemberOut  `json:"members"`
	Rules        []contributionRuleIn     `json:"rules,omitzero"`
	Matched      []contributionMatchedOut `json:"matched,omitzero"        jsonschema:"securities a rule takes"`

	Questions      []string `json:"questions,omitzero"       jsonschema:"the investor's yes-or-no questions of the group"`
	QuestionIdeals bool     `json:"question_ideals,omitzero" jsonschema:"true when the member target_bp values derive from the answers and one answer is yes"`
	QuestionFacts  []string `json:"question_facts,omitzero"  jsonschema:"one fact key per question, empty for the investor's own; a question with one is answered from the company's filings and price"`
	QuestionLimits []string `json:"question_limits,omitzero" jsonschema:"one limit per question, empty without one; a rate is a fraction"`
}

type contributionMatchedOut struct {
	Instrument string     `json:"instrument"`
	Value      tool.Money `json:"value"`
	ShareBP    int        `json:"share_bp,omitzero"`
}

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
}

type contributionFactDetail struct {
	Value  string    `json:"value,omitzero"`
	Reason string    `json:"reason,omitzero"`
	Date   tool.Date `json:"date,omitzero"`
}

type contributionOutside struct {
	AccountID  string     `json:"account_id,omitzero"`
	Instrument string     `json:"instrument,omitzero"`
	Value      tool.Money `json:"value,omitzero"`
	ReturnKind string     `json:"return_kind,omitzero"`
}

type contributionMissing struct {
	AccountID  string `json:"account_id,omitzero"`
	Instrument string `json:"instrument,omitzero"`
	Kind       string `json:"kind"`
}

func contributionResult(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in getPortfolioIn,
) (getPortfolioOut, error) {
	v, err := svc.ContributionPlan(ctx, booksID)
	if err != nil {
		return getPortfolioOut{}, err
	}

	if in.Amount != "" {
		// The total of the stored view carries the base currency of the book.
		unit, err := money.New(0, v.Total.Currency())
		if err != nil {
			return getPortfolioOut{}, err
		}

		amount, err := tool.ParsePositive("amount", in.Amount, unit)
		if err != nil {
			return getPortfolioOut{}, err
		}

		if v, err = svc.PreviewSavedContribution(ctx, booksID, amount); err != nil {
			return getPortfolioOut{}, err
		}
	}

	out := contributionViewOf(v)

	return getPortfolioOut{Contribution: out}, nil
}

func contributionViewOf(v app.ContributionView) contributionView {
	out := contributionView{
		Status:       "complete",
		Amount:       optionalMoney(v.Amount),
		Total:        tool.MoneyOf(v.Total),
		TotalAfter:   optionalMoney(v.TotalAfter),
		DriftBP:      valueOf(v.DriftBP),
		DriftAfterBP: valueOf(v.DriftAfterBP),
		Leftover:     optionalMoney(v.Leftover),
		Classes:      []contributionClassOut{},
		Outside:      []contributionOutside{},
		Missing:      []contributionMissing{},

		GuaranteeName: v.GuaranteeName,
	}
	if !v.Complete {
		out.Status = "incomplete"
	}

	for _, c := range v.Classes {
		out.Classes = append(out.Classes, contributionClassOf(c))
	}

	for _, o := range v.Outside {
		out.Outside = append(out.Outside, contributionOutside{
			AccountID:  idText(o.AccountID),
			Instrument: string(o.Instrument),
			Value:      optionalMoney(o.Value),
			ReturnKind: o.ReturnKind,
		})
	}

	for _, m := range v.Missing {
		out.Missing = append(out.Missing, contributionMissing{
			AccountID:  idText(m.AccountID),
			Instrument: string(m.Instrument),
			Kind:       m.Kind,
		})
	}

	return out
}

func contributionClassOf(c app.ContributionClass) contributionClassOut {
	out := contributionClassOut{
		Name:         c.Name,
		TargetBP:     c.TargetBP,
		Value:        tool.MoneyOf(c.Value),
		ShareBP:      valueOf(c.ShareBP),
		AfterShareBP: valueOf(c.AfterShareBP),
		Amount:       optionalMoney(c.Amount),
		Cost:         optionalMoney(c.Cost),
		Members:      []contributionMemberOut{},

		Questions:      c.Questions,
		QuestionIdeals: c.QuestionIdeals,
		QuestionFacts:  c.QuestionFacts,
		QuestionLimits: c.QuestionLimits,
	}

	for _, r := range c.Rules {
		out.Rules = append(out.Rules, contributionRuleOf(r))
	}

	for _, m := range c.Matched {
		out.Matched = append(out.Matched, contributionMatchedOut{
			Instrument: string(m.Instrument),
			Value:      tool.MoneyOf(m.Value),
			ShareBP:    valueOf(m.ShareBP),
		})
	}

	for _, m := range c.Members {
		out.Members = append(out.Members, contributionMemberOut{
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
		})
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

func contributionRuleOf(r domain.PlanRule) contributionRuleIn {
	out := contributionRuleIn{
		InstrumentType:  r.InstrumentType,
		Subtypes:        r.Subtypes,
		QuoteCurrency:   string(r.QuoteCurrency),
		ReturnKind:      r.ReturnKind,
		MaturesFromYear: valueOf(r.MaturesFromYear),
		MaturesToYear:   valueOf(r.MaturesToYear),
		Guarantee:       r.Guarantee,
	}
	if r.DailyLiquidity != nil {
		out.DailyLiquidity = tool.OptionalBool{B: *r.DailyLiquidity, Set: true}
	}

	return out
}

func optionalMoney(m *money.Money) tool.Money {
	if m == nil {
		return tool.Money{}
	}

	return tool.MoneyOf(*m)
}

func idText(id uuid.UUID) string {
	if id == uuid.Nil {
		return ""
	}

	return id.String()
}
