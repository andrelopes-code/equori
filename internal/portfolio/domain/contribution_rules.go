package domain

import (
	"errors"
	"fmt"
	"regexp"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

const (
	ReturnRate      = "rate"
	ReturnInflation = "inflation"
	ReturnFixed     = "fixed"

	GuaranteeCovered   = "covered"
	GuaranteeSovereign = "sovereign"
	GuaranteeUncovered = "uncovered"

	maxClassRules = 5
	maxSubtypes   = 20
	minRuleYear   = 1900
	maxRuleYear   = 2200

	fixedIncomeType = "fixed_income"
	currencyType    = "currency"
)

var (
	ErrRuleInvalid = errors.New("invalid contribution rule")

	catalogKeyPattern = regexp.MustCompile(`^[a-z0-9_]{2,40}$`)
)

// PlanRule is a conjunction of the conditions it sets over the facts of a security (GR2).
type PlanRule struct {
	InstrumentType  string
	Subtypes        []string
	QuoteCurrency   money.Currency
	ReturnKind      string
	MaturesFromYear *int
	MaturesToYear   *int
	DailyLiquidity  *bool
	Guarantee       string
}

// SecurityFacts are what a rule reads of a held security (GR2 to GR4). Contract is false when the
// security has no facts of GR3; ReturnKind, MaturesOn, DailyLiquidity and Sovereign are then unset.
type SecurityFacts struct {
	Type, Subtype  string
	QuoteCurrency  money.Currency
	Contract       bool
	ReturnKind     string
	MaturesOn      time.Time
	DailyLiquidity bool
	Sovereign      bool
}

// Meets reports whether f meets every condition of r; g is nil without a guarantee (GR4).
func (r PlanRule) Meets(f SecurityFacts, g *Guarantee) bool {
	return r.meetsIdentity(f) && r.meetsContract(f) && r.meetsGuarantee(f, g)
}

// ClassOf returns the class of a held security (GR5): the class of an instrument member naming
// code, else the first class with a rule f meets; false outside the plan.
func (p Plan) ClassOf(code money.Currency, f SecurityFacts, g *Guarantee) (int, bool) {
	for i, c := range p.Classes {
		if slices.ContainsFunc(c.Members, func(m PlanMember) bool { return m.Instrument == code }) {
			return i, true
		}
	}

	for i, c := range p.Classes {
		if slices.ContainsFunc(c.Rules, func(r PlanRule) bool { return r.Meets(f, g) }) {
			return i, true
		}
	}

	return 0, false
}

// HasRules reports whether a class gathers its securities by rule.
func (c PlanClass) HasRules() bool { return len(c.Rules) > 0 }

func (c PlanClass) checkRules() error {
	if !c.HasRules() {
		return nil
	}

	switch {
	case len(c.Members) > 0:
		return ruleError(c, "rules and members together")
	case len(c.Questions) > 0:
		return ruleError(c, "rules and questions together")
	case len(c.Rules) > maxClassRules:
		return ruleError(c, "%d rules", len(c.Rules))
	}

	for _, r := range c.Rules {
		if reason := r.invalidReason(); reason != "" {
			return ruleError(c, "%s", reason)
		}
	}

	return nil
}

func (r PlanRule) meetsIdentity(f SecurityFacts) bool {
	switch {
	case r.InstrumentType != "" && r.InstrumentType != f.Type:
		return false
	case r.Subtypes != nil && !slices.Contains(r.Subtypes, f.Subtype):
		return false
	case r.QuoteCurrency != "" && r.QuoteCurrency != f.QuoteCurrency:
		return false
	}

	return true
}

func (r PlanRule) meetsContract(f SecurityFacts) bool {
	if r.ReturnKind == "" && r.MaturesFromYear == nil && r.MaturesToYear == nil &&
		r.DailyLiquidity == nil {
		return true
	}

	if !f.Contract {
		return false
	}

	year := f.MaturesOn.Year()

	switch {
	case r.ReturnKind != "" && r.ReturnKind != f.ReturnKind:
		return false
	case r.MaturesFromYear != nil && year < *r.MaturesFromYear:
		return false
	case r.MaturesToYear != nil && year > *r.MaturesToYear:
		return false
	case r.DailyLiquidity != nil && *r.DailyLiquidity != f.DailyLiquidity:
		return false
	}

	return true
}

func (r PlanRule) meetsGuarantee(f SecurityFacts, g *Guarantee) bool {
	if r.Guarantee == "" {
		return true
	}

	if g == nil {
		return false
	}

	covered := g.Covered(f.Subtype)
	sovereign := g.Sovereign(f.Subtype) || f.Sovereign

	switch r.Guarantee {
	case GuaranteeCovered:
		return covered
	case GuaranteeSovereign:
		return sovereign
	case GuaranteeUncovered:
		return f.Type == fixedIncomeType && !covered && !sovereign
	}

	return false
}

// invalidReason returns the GR2 violation of r, or "" when r is valid.
func (r PlanRule) invalidReason() string {
	switch {
	case r.isEmpty():
		return "a rule sets no condition"
	case r.InstrumentType != "" && !validCatalogKey(r.InstrumentType),
		r.InstrumentType == currencyType:
		return fmt.Sprintf("instrument type %q", r.InstrumentType)
	case r.Subtypes != nil && r.InstrumentType == "":
		return "subtypes without an instrument type"
	case r.Subtypes != nil:
		return r.invalidSubtypes()
	}

	return r.invalidContract()
}

func (r PlanRule) invalidSubtypes() string {
	if n := len(r.Subtypes); n < 1 || n > maxSubtypes {
		return fmt.Sprintf("%d subtypes", n)
	}

	seen := map[string]bool{}

	for _, s := range r.Subtypes {
		if !validCatalogKey(s) || seen[s] {
			return fmt.Sprintf("subtype %q", s)
		}

		seen[s] = true
	}

	return ""
}

func (r PlanRule) invalidContract() string {
	switch {
	case r.ReturnKind != "" && !slices.Contains(returnKinds(), r.ReturnKind):
		return fmt.Sprintf("return kind %q", r.ReturnKind)
	case r.ReturnKind != "" && r.InstrumentType != "" && r.InstrumentType != fixedIncomeType:
		return "return kind of a type other than fixed income"
	case !validYear(r.MaturesFromYear), !validYear(r.MaturesToYear):
		return "maturity year outside 1900 to 2200"
	case r.yearsReversed():
		return "maturity from year after to year"
	case r.Guarantee != "" && !slices.Contains(guaranteeKinds(), r.Guarantee):
		return fmt.Sprintf("guarantee %q", r.Guarantee)
	}

	return ""
}

func (r PlanRule) yearsReversed() bool {
	return r.MaturesFromYear != nil && r.MaturesToYear != nil &&
		*r.MaturesFromYear > *r.MaturesToYear
}

func (r PlanRule) isEmpty() bool {
	return r.InstrumentType == "" && r.Subtypes == nil && r.QuoteCurrency == "" &&
		r.ReturnKind == "" && r.MaturesFromYear == nil && r.MaturesToYear == nil &&
		r.DailyLiquidity == nil && r.Guarantee == ""
}

func ruleError(c PlanClass, format string, args ...any) error {
	return fmt.Errorf("%w: class %q: %s", ErrRuleInvalid, c.Name, fmt.Sprintf(format, args...))
}

func validCatalogKey(s string) bool { return catalogKeyPattern.MatchString(s) }

func validYear(y *int) bool { return y == nil || (*y >= minRuleYear && *y <= maxRuleYear) }

func returnKinds() []string { return []string{ReturnRate, ReturnInflation, ReturnFixed} }

func guaranteeKinds() []string {
	return []string{GuaranteeCovered, GuaranteeSovereign, GuaranteeUncovered}
}
