package domain

import (
	"errors"
	"slices"
	"testing"
	"time"
)

func TestCompanyFactsAnswers(t *testing.T) {
	t.Parallel()

	keys := []string{
		"piotroski_p1", "piotroski_p2", "piotroski_p3", "piotroski_p4", "piotroski_p5",
		"piotroski_p6", "piotroski_p7", "piotroski_p8", "piotroski_p9",
	}
	end := time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC)

	for name, tc := range map[string]struct {
		facts    CompanyFacts
		keys     []string
		want     []FactAnswer
		wantYear time.Time
		wantOK   bool
	}{
		"FQ10 nine yes": {
			facts:    standardFacts(factsT(), factsT1(), factsT2()),
			keys:     keys,
			want:     answers("yes", "yes", "yes", "yes", "yes", "yes", "yes", "yes", "yes"),
			wantYear: end,
			wantOK:   true,
		},
		"FQ10 shares 110 and gross profit 30000": {
			facts: standardFacts(
				with(factsT(), func(y *FiscalYear) {
					y.SharesIssued = i64(110)
					y.CapitalRaised = flag(true)
					y.GrossProfit = i64(30_000)
				}),
				factsT1(),
				factsT2(),
			),
			keys:     keys,
			want:     answers("yes", "yes", "yes", "yes", "yes", "yes", "no", "no", "yes"),
			wantYear: end,
			wantOK:   true,
		},
		"FQ10 without t-2": {
			facts:    standardFacts(factsT(), factsT1()),
			keys:     keys,
			want:     answers("yes", "yes", "none", "yes", "none", "yes", "yes", "yes", "none"),
			wantYear: end,
			wantOK:   true,
		},
		"FQ10 one fiscal year": {
			facts:  standardFacts(factsT()),
			keys:   keys,
			want:   answers("none", "none", "none", "none", "none", "none", "none", "none", "none"),
			wantOK: false,
		},
		"FQ10 chart other": {
			facts: CompanyFacts{Years: []FiscalYear{factsT(), factsT1(), factsT2()}},
			keys:  keys,
			want:  answers("none", "none", "none", "none", "none", "none", "none", "none", "none"),
		},
		"FQ10 financial company of the standard chart": {
			facts: CompanyFacts{
				Standard:  true,
				Financial: true,
				Years:     []FiscalYear{factsT(), factsT1(), factsT2()},
			},
			keys: keys,
			want: answers("none", "none", "none", "none", "none", "none", "none", "none", "none"),
		},
		"FQ10 current liabilities zero in t": {
			facts: standardFacts(
				with(factsT(), func(y *FiscalYear) { y.CurrentLiabilities = i64(0) }),
				factsT1(),
				factsT2(),
			),
			keys:     keys,
			want:     answers("yes", "yes", "yes", "yes", "yes", "none", "yes", "yes", "yes"),
			wantYear: end,
			wantOK:   true,
		},
		"empty key and unknown key": {
			facts:    standardFacts(factsT(), factsT1(), factsT2()),
			keys:     []string{"", "piotroski_p1", "piotroski_p10"},
			want:     answers("none", "yes", "none"),
			wantYear: end,
			wantOK:   true,
		},
		"missing input of a ratio": {
			facts: standardFacts(
				with(factsT(), func(y *FiscalYear) { y.NetIncome = nil }),
				factsT1(),
				factsT2(),
			),
			keys:     keys[:4],
			want:     answers("none", "yes", "none", "none"),
			wantYear: end,
			wantOK:   true,
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got, year, ok := tc.facts.Answers(tc.keys)
			if ok != tc.wantOK {
				t.Fatalf("ok = %t, want %t", ok, tc.wantOK)
			}

			if !year.Equal(tc.wantYear) {
				t.Fatalf("year = %v, want %v", year, tc.wantYear)
			}

			if !slices.Equal(got, tc.want) {
				t.Fatalf("answers = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestSignalDetail(t *testing.T) {
	t.Parallel()

	years := []FiscalYear{factsT(), factsT1()}
	financial := standardFacts(years...)
	financial.Financial = true

	for name, tc := range map[string]struct {
		facts  CompanyFacts
		answer FactAnswer
		want   string
	}{
		"answered":          {standardFacts(years...), FactYes, ""},
		"financial company": {financial, FactNone, "financial"},
		"another chart":     {CompanyFacts{Years: years}, FactNone, "chart"},
		"no input":          {standardFacts(years...), FactNone, "missing"},
		"one fiscal year":   {standardFacts(factsT()), FactNone, "short_history"},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if got := tc.facts.SignalDetail(tc.answer).Reason; got != tc.want {
				t.Fatalf("reason = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestNoSharesIssued(t *testing.T) {
	t.Parallel()

	for name, tc := range map[string]struct {
		raised *bool
		shares *int64
		want   FactAnswer
	}{
		"CR11 new resources":                 {flag(true), i64(110), FactNo},
		"CR11 new resources, fewer shares":   {flag(true), i64(90), FactNo},
		"CR11 reserves":                      {flag(false), i64(110), FactYes},
		"CR11 reserves, without a count":     {flag(false), nil, FactYes},
		"CR11 no rise of the capital":        {nil, i64(100), FactYes},
		"CR11 fewer shares":                  {nil, i64(90), FactYes},
		"CR11 more shares of no known cause": {nil, i64(110), FactNone},
		"CR11 neither":                       {nil, nil, FactNone},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			facts := standardFacts(with(factsT(), func(y *FiscalYear) {
				y.CapitalRaised, y.SharesIssued = tc.raised, tc.shares
			}), factsT1())

			got, _, _ := facts.Answers([]string{"piotroski_p7"})
			if got[0] != tc.want {
				t.Fatalf("P7 = %s, want %s", got[0], tc.want)
			}
		})
	}
}

func TestFactKnown(t *testing.T) {
	t.Parallel()

	for key, want := range map[string]bool{
		"piotroski_p1":  true,
		"piotroski_p9":  true,
		"piotroski_p10": false,
		"piotroski_p0":  false,
		"P1":            false,
		"":              false,
	} {
		if got := FactKnown(key); got != want {
			t.Errorf("FactKnown(%q) = %t, want %t", key, got, want)
		}
	}
}

func TestQuestionFactsInvalid(t *testing.T) {
	t.Parallel()

	two := []string{"Sinal", "Tem tag along?"}

	for name, tc := range map[string]struct {
		questions []string
		facts     []string
	}{
		"unknown key":                {questions: two[:1], facts: []string{"piotroski_p10"}},
		"repeated fact":              {questions: two, facts: []string{"piotroski_p1", "piotroski_p1"}},
		"one fact for two questions": {questions: two, facts: []string{"piotroski_p1"}},
		"fact without questions":     {questions: nil, facts: []string{"piotroski_p1"}},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			c := factClass(tc.questions, tc.facts)
			_, err := (Plan{Classes: []PlanClass{c}}).WithIdeals()

			if !errors.Is(err, ErrQuestionInvalid) {
				t.Fatalf("err = %v, want ErrQuestionInvalid", err)
			}
		})
	}
}

func TestQuestionFactsFilled(t *testing.T) {
	t.Parallel()

	c := questionClass([]string{"Q1", "Q2"}, []bool{true, false}, []bool{false, true})

	got, err := (Plan{Classes: []PlanClass{c}}).WithIdeals()
	if err != nil {
		t.Fatal(err)
	}

	if want := []string{"", ""}; !slices.Equal(got.Classes[0].QuestionFacts, want) {
		t.Fatalf("QuestionFacts = %q, want %q", got.Classes[0].QuestionFacts, want)
	}
}

func TestIdealsFromFactAnswers(t *testing.T) {
	t.Parallel()

	questions := []string{"Sinal", "Tem tag along?"}
	facts := []string{"piotroski_p1", ""}

	for name, tc := range map[string]struct {
		a, b []FactAnswer
		ansA []*bool
		want []*int
	}{
		"FQ10 fact yes over a stored no": {
			a:    answers(FactYes, FactNone),
			b:    answers(FactNone, FactNone),
			ansA: said(false, true),
			want: targets(6667, 3333),
		},
		"FQ10 fact no over a stored yes": {
			a:    answers(FactNo, FactNone),
			b:    answers(FactNone, FactNone),
			ansA: said(true, true),
			want: targets(5000, 5000),
		},
		"no fact answers keeps the stored answers": {
			ansA: said(false, true),
			want: targets(5000, 5000),
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			c := factClass(questions, facts)
			c.Members = []PlanMember{
				{Instrument: "QSTA3", Answers: tc.ansA, FactAnswers: tc.a},
				{Instrument: "QSTB3", Answers: said(true, false), FactAnswers: tc.b},
			}

			got, err := (Plan{Classes: []PlanClass{c}}).WithIdeals()
			if err != nil {
				t.Fatal(err)
			}

			if g := memberTargets(got.Classes[0]); !slices.EqualFunc(g, tc.want, equalTarget) {
				t.Fatalf("targets = %v, want %v", show(g), show(tc.want))
			}
		})
	}
}

func TestIdealsWithoutEveryAnswer(t *testing.T) {
	t.Parallel()

	none := answers(FactNone, FactNone)
	signals := func(p1, p2 FactAnswer) []FactAnswer { return answers(p1, p2) }

	for name, tc := range map[string]struct {
		members []PlanMember
		want    []*int
	}{
		"CQ3 the equal share, the others by points": {
			members: []PlanMember{
				{Answers: make([]*bool, 2), FactAnswers: signals(FactYes, FactYes)},
				{Answers: make([]*bool, 2), FactAnswers: signals(FactYes, FactNo)},
				{Answers: make([]*bool, 2), FactAnswers: none},
				{Answers: make([]*bool, 2), FactAnswers: none},
			},
			want: targets(3333, 1667, 2500, 2500),
		},
		"CQ3 one blank answer leaves the points": {
			members: []PlanMember{
				{Answers: make([]*bool, 2), FactAnswers: signals(FactYes, FactYes)},
				{Answers: make([]*bool, 2), FactAnswers: signals(FactYes, FactNone)},
			},
			want: targets(5000, 5000),
		},
		"CQ3 no answered by the filings is a no": {
			members: []PlanMember{
				{Answers: make([]*bool, 2), FactAnswers: signals(FactYes, FactNo)},
				{Answers: make([]*bool, 2), FactAnswers: signals(FactNo, FactNo)},
			},
			want: targets(10000, 0),
		},
		"CQ3 the investor answers what the filings do not": {
			members: []PlanMember{
				{Answers: make([]*bool, 2), FactAnswers: signals(FactYes, FactYes)},
				{Answers: said(false, false), FactAnswers: none},
			},
			want: targets(10000, 0),
		},
		"CQ3 no member with every answer": {
			members: []PlanMember{
				{Answers: make([]*bool, 2), FactAnswers: none},
				{Answers: make([]*bool, 2), FactAnswers: none},
			},
			want: []*int{nil, nil},
		},
		"CQ3 no yes among the members with every answer": {
			members: []PlanMember{
				{Answers: make([]*bool, 2), FactAnswers: signals(FactNo, FactNo)},
				{Answers: make([]*bool, 2), FactAnswers: none},
			},
			want: []*int{nil, nil},
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			c := factClass([]string{"P1", "P2"}, []string{"piotroski_p1", "piotroski_p2"})
			c.Members = tc.members

			got, err := (Plan{Classes: []PlanClass{c}}).WithIdeals()
			if err != nil {
				t.Fatal(err)
			}

			if g := memberTargets(got.Classes[0]); !slices.EqualFunc(g, tc.want, equalTarget) {
				t.Fatalf("targets = %v, want %v", show(g), show(tc.want))
			}
		})
	}
}

func factClass(questions, facts []string) PlanClass {
	c := PlanClass{
		Name:          "Facts",
		TargetBP:      fullTargetBP,
		Questions:     questions,
		QuestionFacts: facts,
	}

	if len(questions) > 0 {
		c.Members = []PlanMember{{
			Instrument: "QSTA3",
			Answers:    said(make([]bool, len(questions))...),
		}}
	}

	return c
}

func flag(v bool) *bool { return &v }

func i64(v int64) *int64 { return &v }

func answers(values ...FactAnswer) []FactAnswer { return values }

func standardFacts(years ...FiscalYear) CompanyFacts {
	return CompanyFacts{Standard: true, Years: years}
}

func with(y FiscalYear, change func(*FiscalYear)) FiscalYear {
	change(&y)

	return y
}

func factsT() FiscalYear {
	return FiscalYear{
		End:                time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC),
		NetIncome:          i64(7_700),
		OperatingCashFlow:  i64(9_000),
		TotalAssets:        i64(120_000),
		LongDebt:           i64(28_000),
		CurrentAssets:      i64(45_000),
		CurrentLiabilities: i64(20_000),
		SharesIssued:       i64(100),
		Revenue:            i64(100_000),
		GrossProfit:        i64(32_000),
	}
}

func factsT1() FiscalYear {
	return FiscalYear{
		End:                time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC),
		NetIncome:          i64(5_000),
		OperatingCashFlow:  i64(6_000),
		TotalAssets:        i64(110_000),
		LongDebt:           i64(30_000),
		CurrentAssets:      i64(40_000),
		CurrentLiabilities: i64(20_000),
		SharesIssued:       i64(100),
		Revenue:            i64(90_000),
		GrossProfit:        i64(27_000),
	}
}

func factsT2() FiscalYear {
	return FiscalYear{
		End:         time.Date(2023, 12, 31, 0, 0, 0, 0, time.UTC),
		TotalAssets: i64(100_000),
	}
}
