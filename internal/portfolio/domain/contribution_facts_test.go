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
			facts:    CompanyFacts{Years: []FiscalYear{factsT(), factsT1(), factsT2()}},
			keys:     keys,
			want:     answers("yes", "none", "yes", "none", "none", "none", "yes", "none", "none"),
			wantYear: end,
			wantOK:   true,
		},
		"FQ10 chart other, one fiscal year": {
			facts: CompanyFacts{Years: []FiscalYear{factsT()}},
			keys:  keys,
			want:  answers("none", "none", "none", "none", "none", "none", "none", "none", "none"),
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

	bank := CompanyFacts{Years: []FiscalYear{factsT(), factsT1()}}

	for name, tc := range map[string]struct {
		facts  CompanyFacts
		key    string
		answer FactAnswer
		want   string
	}{
		"answered":                 {bank, "piotroski_p1", FactYes, ""},
		"outside the chart":        {bank, "piotroski_p6", FactNone, "chart"},
		"in every chart, no input": {bank, "piotroski_p3", FactNone, "missing"},
		"in every chart, one year": {
			CompanyFacts{Years: []FiscalYear{factsT()}}, "piotroski_p7", FactNone, "short_history",
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if got := tc.facts.SignalDetail(tc.key, tc.answer).Reason; got != tc.want {
				t.Fatalf("reason = %q, want %q", got, tc.want)
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
		ansA []bool
		want []*int
	}{
		"FQ10 fact yes over a stored no": {
			a:    answers(FactYes, FactNone),
			b:    answers(FactNone, FactNone),
			ansA: []bool{false, true},
			want: targets(6667, 3333),
		},
		"FQ10 fact no over a stored yes": {
			a:    answers(FactNo, FactNone),
			b:    answers(FactNone, FactNone),
			ansA: []bool{true, true},
			want: targets(5000, 5000),
		},
		"no fact answers keeps the stored answers": {
			ansA: []bool{false, true},
			want: targets(5000, 5000),
		},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			c := factClass(questions, facts)
			c.Members = []PlanMember{
				{Instrument: "QSTA3", Answers: tc.ansA, FactAnswers: tc.a},
				{Instrument: "QSTB3", Answers: []bool{true, false}, FactAnswers: tc.b},
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
			Answers:    make([]bool, len(questions)),
		}}
	}

	return c
}

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
