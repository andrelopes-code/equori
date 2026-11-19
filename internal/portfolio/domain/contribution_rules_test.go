package domain

import (
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func TestRuleMeets(t *testing.T) {
	t.Parallel()

	g := ruleGuarantee()
	daily := PlanRule{DailyLiquidity: boolPtr(true)}
	covered := PlanRule{Guarantee: GuaranteeCovered}
	uncovered := PlanRule{Guarantee: GuaranteeUncovered}
	sovereign := PlanRule{Guarantee: GuaranteeSovereign}
	maturing2026 := ruleCDB()
	maturing2026.MaturesOn = time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC)

	for _, c := range []struct {
		name  string
		rule  PlanRule
		facts SecurityFacts
		g     *Guarantee
		want  bool
	}{
		{
			"type and rate meet CDB A",
			PlanRule{InstrumentType: "fixed_income", ReturnKind: ReturnRate},
			ruleCDB(), &g, true,
		},
		{
			"type and rate meet LCI B",
			PlanRule{InstrumentType: "fixed_income", ReturnKind: ReturnRate},
			ruleLCI(), &g, true,
		},
		{
			"type and rate leave NTNB",
			PlanRule{InstrumentType: "fixed_income", ReturnKind: ReturnRate},
			ruleNTNB(), &g, false,
		},
		{
			"inflation within the years meets NTNB",
			PlanRule{
				ReturnKind:      ReturnInflation,
				MaturesFromYear: intPtr(2031),
				MaturesToYear:   intPtr(2040),
			},
			ruleNTNB(), &g, true,
		},
		{
			"inflation within the years leaves a stock",
			PlanRule{
				ReturnKind:      ReturnInflation,
				MaturesFromYear: intPtr(2031),
				MaturesToYear:   intPtr(2040),
			},
			ruleStock(), &g, false,
		},
		{"daily liquidity meets LCI B", daily, ruleLCI(), &g, true},
		{"daily liquidity leaves CDB A", daily, ruleCDB(), &g, false},
		{"daily liquidity leaves a stock", daily, ruleStock(), &g, false},
		{"covered meets CDB A", covered, ruleCDB(), &g, true},
		{"covered leaves a debenture", covered, ruleDebenture(), &g, false},
		{"covered without guarantee", covered, ruleCDB(), nil, false},
		{"sovereign meets NTNB by fact", sovereign, ruleNTNB(), &g, true},
		{"uncovered meets a debenture", uncovered, ruleDebenture(), &g, true},
		{"uncovered leaves NTNB", uncovered, ruleNTNB(), &g, false},
		{"uncovered leaves CDB A", uncovered, ruleCDB(), &g, false},
		{"uncovered leaves a stock", uncovered, ruleStock(), &g, false},
		{
			"subtypes meet LCI B",
			PlanRule{InstrumentType: "fixed_income", Subtypes: []string{"lci", "lca"}},
			ruleLCI(), &g, true,
		},
		{
			"subtypes leave CDB A",
			PlanRule{InstrumentType: "fixed_income", Subtypes: []string{"lci", "lca"}},
			ruleCDB(), &g, false,
		},
		{"quote currency meets a USD ETF", PlanRule{QuoteCurrency: "USD"}, ruleUSDETF(), &g, true},
		{"quote currency leaves CDB A", PlanRule{QuoteCurrency: "USD"}, ruleCDB(), &g, false},
		{
			"bound year meets a maturity on 2026-12-31",
			PlanRule{MaturesToYear: intPtr(2026)},
			maturing2026, &g, true,
		},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			if got := c.rule.Meets(c.facts, c.g); got != c.want {
				t.Errorf("Meets = %v, want %v", got, c.want)
			}
		})
	}
}

func TestClassOfGR12(t *testing.T) {
	t.Parallel()

	g := ruleGuarantee()
	plan := gr12Plan()

	for _, c := range []struct {
		name  string
		code  money.Currency
		facts SecurityFacts
		want  int
		ok    bool
	}{
		{"LCI B", "LCIB", ruleLCI(), 0, true},
		{"CDB A", "CDBA", ruleCDB(), 1, true},
		{"NTNB", "NTNB.20350515", ruleNTNB(), 2, true},
		{"stock X by member", "STOCKX", ruleStock(), 3, true},
		{"stock Y outside", "STOCKY", ruleStock(), 0, false},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			got, ok := plan.ClassOf(c.code, c.facts, &g)
			if got != c.want || ok != c.ok {
				t.Errorf("ClassOf = %d, %v, want %d, %v", got, ok, c.want, c.ok)
			}
		})
	}

	slots := []Slot{{2000, 500000}, {3000, 1000000}, {2000, 300000}, {3000, 200000}}
	if got, want := Split(slots, 200000), []int64{0, 0, 0, 200000}; !slices.Equal(got, want) {
		t.Errorf("Split by rule = %v, want %v", got, want)
	}

	if bp, ok := Drift(slots); bp != 2500 || !ok {
		t.Errorf("Drift = %d, %v, want 2500, true", bp, ok)
	}

	empty := []Slot{{2000, 0}, {3000, 0}, {2000, 0}, {3000, 200000}}
	if got, want := Split(
		empty,
		200000,
	), []int64{
		57143,
		85714,
		57143,
		0,
	}; !slices.Equal(
		got,
		want,
	) {
		t.Errorf("Split by member = %v, want %v", got, want)
	}

	if err := plan.Check(); err != nil {
		t.Errorf("Check of the GR12 plan = %v", err)
	}
}

func TestRuleCheck(t *testing.T) {
	t.Parallel()

	rate := PlanRule{InstrumentType: "fixed_income"}
	years := intPtr(2030)
	dup := []string{"cdb", "cdb"}
	upper := []string{"CDB"}
	member := PlanMember{Instrument: "STOCKX"}

	for _, c := range []struct {
		name  string
		class PlanClass
	}{
		{"member and rule", ruleClass(PlanClass{Members: []PlanMember{member}}, rate)},
		{"rule and question", ruleClass(PlanClass{Questions: []string{"q"}}, rate)},
		{"six rules", ruleClass(PlanClass{}, rate, rate, rate, rate, rate, rate)},
		{"no condition", byRule(PlanRule{})},
		{"currency type", byRule(PlanRule{InstrumentType: "currency"})},
		{"type with capital", byRule(PlanRule{InstrumentType: "Fixed"})},
		{"subtypes without type", byRule(PlanRule{Subtypes: []string{"cdb"}})},
		{"empty subtypes", byRule(PlanRule{InstrumentType: "fixed_income", Subtypes: []string{}})},
		{"21 subtypes", byRule(PlanRule{InstrumentType: "fixed_income", Subtypes: subtypes(21)})},
		{"repeated subtype", byRule(PlanRule{InstrumentType: "fixed_income", Subtypes: dup})},
		{"subtype with capital", byRule(PlanRule{InstrumentType: "fixed_income", Subtypes: upper})},
		{"return kind float", byRule(PlanRule{ReturnKind: "float"})},
		{"rate of a stock", byRule(PlanRule{InstrumentType: "stock", ReturnKind: ReturnRate})},
		{"year 1899", byRule(PlanRule{MaturesFromYear: intPtr(1899)})},
		{"year 2201", byRule(PlanRule{MaturesToYear: intPtr(2201)})},
		{"from after to", byRule(PlanRule{MaturesFromYear: intPtr(2035), MaturesToYear: years})},
		{"guarantee fgc", byRule(PlanRule{Guarantee: "fgc"})},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			c.class.TargetBP = fullTargetBP
			err := Plan{Classes: []PlanClass{c.class}}.Check()

			if !errors.Is(err, ErrRuleInvalid) {
				t.Errorf("Check = %v, want ErrRuleInvalid", err)
			}
		})
	}

	valid := ruleClass(PlanClass{Name: "Renda fixa", TargetBP: 10000}, rate)
	if err := (Plan{Classes: []PlanClass{valid}}).Check(); err != nil {
		t.Errorf("Check of a valid rule = %v", err)
	}
}

func gr12Plan() Plan {
	return Plan{Classes: []PlanClass{
		{Name: "Reserva", TargetBP: 2000, Rules: []PlanRule{{DailyLiquidity: boolPtr(true)}}},
		{
			Name:     "Pós",
			TargetBP: 3000,
			Rules:    []PlanRule{{InstrumentType: "fixed_income", ReturnKind: ReturnRate}},
		},
		{
			Name:     "IPCA+",
			TargetBP: 2000,
			Rules: []PlanRule{{
				ReturnKind:      ReturnInflation,
				MaturesFromYear: intPtr(2031),
				MaturesToYear:   intPtr(2040),
			}},
		},
		{Name: "Ações", TargetBP: 3000, Members: []PlanMember{{Instrument: "STOCKX"}}},
	}}
}

func byRule(r PlanRule) PlanClass { return ruleClass(PlanClass{}, r) }

func ruleClass(c PlanClass, rules ...PlanRule) PlanClass {
	if c.Name == "" {
		c.Name = "Grupo"
	}

	c.Rules = rules

	return c
}

func ruleGuarantee() Guarantee {
	m, _ := money.New(1, "BRL")

	return NewGuarantee("FGC", m, m, 4, "cdb", "lci").WithSovereign("tesouro")
}

func ruleCDB() SecurityFacts {
	return SecurityFacts{
		Type: "fixed_income", Subtype: "cdb", QuoteCurrency: "BRL", Contract: true,
		ReturnKind: ReturnRate, MaturesOn: time.Date(2027, 6, 1, 0, 0, 0, 0, time.UTC),
	}
}

func ruleLCI() SecurityFacts {
	return SecurityFacts{
		Type: "fixed_income", Subtype: "lci", QuoteCurrency: "BRL", Contract: true,
		ReturnKind: ReturnRate, MaturesOn: time.Date(2028, 6, 1, 0, 0, 0, 0, time.UTC),
		DailyLiquidity: true,
	}
}

func ruleNTNB() SecurityFacts {
	return SecurityFacts{
		Type: "fixed_income", QuoteCurrency: "BRL", Contract: true,
		ReturnKind: ReturnInflation, MaturesOn: time.Date(2035, 5, 15, 0, 0, 0, 0, time.UTC),
		Sovereign: true,
	}
}

func ruleDebenture() SecurityFacts {
	return SecurityFacts{
		Type: "fixed_income", Subtype: "debenture", QuoteCurrency: "BRL", Contract: true,
		ReturnKind: ReturnRate, MaturesOn: time.Date(2030, 1, 1, 0, 0, 0, 0, time.UTC),
	}
}

func ruleStock() SecurityFacts { return SecurityFacts{Type: "stock", QuoteCurrency: "BRL"} }

func ruleUSDETF() SecurityFacts { return SecurityFacts{Type: "etf", QuoteCurrency: "USD"} }

func subtypes(n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = "sub" + string(rune('a'+i))
	}

	return out
}

func intPtr(v int) *int { return &v }

func boolPtr(v bool) *bool { return &v }
