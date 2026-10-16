package domain

import (
	"errors"
	"math/rand/v2"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

func brl(t testing.TB, amount int64) money.Money {
	t.Helper()
	m, err := money.New(amount, "BRL")
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func ptr[T any](v T) *T { return &v }

func day(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

func id() uuid.UUID { return uuid.Must(uuid.NewV7()) }

func TestNormalize(t *testing.T) {
	tests := map[string]string{
		"PADARIA SÃO JOÃO":        "padaria sao joao",
		"  Padaria   São\tJoão  ": "padaria sao joao",
		"AÇAÍ DA ESQUINA":         "acai da esquina",
		"Crème Brûlée Ñandú":      "creme brulee nandu",
		"ŁÓDŹ Œuvre straße":       "lodz œuvre straße",
		"UBER *TRIP 1234":         "uber *trip 1234",
		"":                        "",
	}
	for in, want := range tests {
		if got := Normalize(in); got != want {
			t.Errorf("Normalize(%q) = %q, want %q", in, got, want)
		}
	}
}

type ruleFixture struct {
	checking, card, food, fuel, travel, groceries, cleaning, closed, salary, payee uuid.UUID
	categories                                                                     map[uuid.UUID]Category
}

func newRuleFixture() ruleFixture {
	f := ruleFixture{
		checking: id(), card: id(), food: id(), fuel: id(), travel: id(), groceries: id(), cleaning: id(), closed: id(), salary: id(), payee: id(),
	}
	open := Category{Class: "expense", Instrument: "BRL", OpenedOn: day("2026-01-01")}
	f.categories = map[uuid.UUID]Category{
		f.food: open, f.fuel: open, f.travel: open, f.groceries: open, f.cleaning: open,
		f.closed: {Class: "expense", Instrument: "BRL", OpenedOn: day("2026-01-01"), ClosedOn: ptr(day("2026-09-30"))},
		f.salary: {Class: "income", Instrument: "BRL", OpenedOn: day("2026-01-01")},
	}
	return f
}

// subject is an expense on 2026-10-14, a Wednesday.
func (f ruleFixture) subject(t *testing.T, description string, amount int64) Subject {
	return Subject{
		Date: day("2026-10-14"), Description: description, RawDescription: description, Amount: brl(t, amount),
		Accounts: []uuid.UUID{f.checking}, AccountKinds: []string{"checking"}, Source: "import", Class: "expense",
	}
}

func mustRule(t *testing.T, r Rule) Rule {
	t.Helper()
	if r.Name == "" {
		r.Name = "rule"
	}
	if r.ID == uuid.Nil {
		r.ID = id()
	}
	r.Enabled = true
	got, err := NewRule(r)
	if err != nil {
		t.Fatalf("NewRule: %v", err)
	}
	return got
}

func TestConditionsHold(t *testing.T) {
	f := newRuleFixture()
	s := f.subject(t, "PADARIA SÃO JOÃO 12", -4590)
	s.PayeeID = f.payee
	s.RawDescription = "PAG*PadariaSaoJoao"
	tests := []struct {
		name string
		c    Condition
		want bool
	}{
		{"description equals normalized", Condition{Field: FieldDescription, Operator: OpEquals, Text: []string{"padaria sao joao 12"}}, true},
		{"description equals other", Condition{Field: FieldDescription, Operator: OpEquals, Text: []string{"padaria"}}, false},
		{"description contains accent-free", Condition{Field: FieldDescription, Operator: OpContains, Text: []string{"Sao Joao"}}, true},
		{"description starts with", Condition{Field: FieldDescription, Operator: OpStartsWith, Text: []string{"PADARIA"}}, true},
		{"description starts with middle", Condition{Field: FieldDescription, Operator: OpStartsWith, Text: []string{"são"}}, false},
		{"description regex on original", Condition{Field: FieldDescription, Operator: OpRegex, Text: []string{`JOÃO \d+$`}}, true},
		{"description regex case-sensitive", Condition{Field: FieldDescription, Operator: OpRegex, Text: []string{`joão`}}, false},
		{"description in list", Condition{Field: FieldDescription, Operator: OpInList, Text: []string{"x", "Padaria São João 12"}}, true},
		{"raw description", Condition{Field: FieldRawDescription, Operator: OpContains, Text: []string{"pag*"}}, true},
		{"payee equals", Condition{Field: FieldPayee, Operator: OpEquals, IDs: []uuid.UUID{f.payee}}, true},
		{"payee in list without match", Condition{Field: FieldPayee, Operator: OpInList, IDs: []uuid.UUID{id()}}, false},
		{"amount equals", Condition{Field: FieldAmount, Operator: OpEquals, Money: []money.Money{brl(t, -4590)}}, true},
		{"amount greater than", Condition{Field: FieldAmount, Operator: OpGreaterThan, Money: []money.Money{brl(t, -5000)}}, true},
		{"amount less than", Condition{Field: FieldAmount, Operator: OpLessThan, Money: []money.Money{brl(t, -5000)}}, false},
		{"amount between bounds", Condition{Field: FieldAmount, Operator: OpBetween, Money: []money.Money{brl(t, -4590), brl(t, -4590)}}, true},
		{"amount other currency", Condition{Field: FieldAmount, Operator: OpGreaterThan, Money: []money.Money{func() money.Money { m, _ := money.New(-100000, "USD"); return m }()}}, false},
		{"absolute amount between", Condition{Field: FieldAbsoluteAmount, Operator: OpBetween, Money: []money.Money{brl(t, 4000), brl(t, 5000)}}, true},
		{"account equals", Condition{Field: FieldAccount, Operator: OpEquals, IDs: []uuid.UUID{f.checking}}, true},
		{"account other", Condition{Field: FieldAccount, Operator: OpEquals, IDs: []uuid.UUID{f.card}}, false},
		{"account kind in list", Condition{Field: FieldAccountKind, Operator: OpInList, Text: []string{"credit_card", "checking"}}, true},
		{"source", Condition{Field: FieldSource, Operator: OpEquals, Text: []string{"manual"}}, false},
		{"weekday", Condition{Field: FieldWeekday, Operator: OpEquals, Text: []string{"wednesday"}}, true},
		{"day of month between", Condition{Field: FieldDayOfMonth, Operator: OpBetween, Ints: []int{10, 14}}, true},
		{"day of month greater", Condition{Field: FieldDayOfMonth, Operator: OpGreaterThan, Ints: []int{14}}, false},
		{"day of month in list", Condition{Field: FieldDayOfMonth, Operator: OpInList, Ints: []int{1, 14}}, true},
		{"installment", Condition{Field: FieldInstallment, Operator: OpEquals, Bool: true}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := mustRule(t, Rule{Conditions: []Condition{tt.c}, Actions: []Action{{Type: ActionSetCategory, CategoryID: f.food}}})
			if got := r.matches(newSubject(s)); got != tt.want {
				t.Fatalf("matches = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestNewRuleRejections(t *testing.T) {
	setCategory := []Action{{Type: ActionSetCategory, CategoryID: id()}}
	contains := []Condition{{Field: FieldDescription, Operator: OpContains, Text: []string{"uber"}}}
	tests := []struct {
		name  string
		r     Rule
		field string
	}{
		{"empty name", Rule{Name: " ", Conditions: contains, Actions: setCategory}, "name"},
		{"no conditions", Rule{Name: "r", Actions: setCategory}, "conditions"},
		{"unknown field", Rule{Name: "r", Conditions: []Condition{{Field: "colour", Operator: OpEquals, Text: []string{"x"}}}, Actions: setCategory}, "conditions[0].field"},
		{"operator of another field", Rule{Name: "r", Conditions: []Condition{{Field: FieldPayee, Operator: OpContains, IDs: []uuid.UUID{id()}}}, Actions: setCategory}, "conditions[0].operator"},
		{"invalid regex", Rule{Name: "r", Conditions: []Condition{{Field: FieldDescription, Operator: OpRegex, Text: []string{"("}}}, Actions: setCategory}, "conditions[0].value"},
		{"between reversed", Rule{Name: "r", Conditions: []Condition{{Field: FieldAmount, Operator: OpBetween, Money: []money.Money{brl(t, 10), brl(t, 5)}}}, Actions: setCategory}, "conditions[0].value"},
		{"between one value", Rule{Name: "r", Conditions: []Condition{{Field: FieldDayOfMonth, Operator: OpBetween, Ints: []int{1}}}, Actions: setCategory}, "conditions[0].value"},
		{"day 32", Rule{Name: "r", Conditions: []Condition{{Field: FieldDayOfMonth, Operator: OpEquals, Ints: []int{32}}}, Actions: setCategory}, "conditions[0].value"},
		{"unknown kind", Rule{Name: "r", Conditions: []Condition{{Field: FieldAccountKind, Operator: OpEquals, Text: []string{"bank"}}}, Actions: setCategory}, "conditions[0].value"},
		{"negative absolute", Rule{Name: "r", Conditions: []Condition{{Field: FieldAbsoluteAmount, Operator: OpEquals, Money: []money.Money{brl(t, -1)}}}, Actions: setCategory}, "conditions[0].value"},
		{"empty text", Rule{Name: "r", Conditions: []Condition{{Field: FieldDescription, Operator: OpEquals, Text: []string{""}}}, Actions: setCategory}, "conditions[0].value"},
		{"no actions", Rule{Name: "r", Conditions: contains}, "actions"},
		{"category and split", Rule{Name: "r", Conditions: contains, Actions: []Action{setCategory[0], {Type: ActionSplit, Parts: []Part{{CategoryID: id(), Percent: 5000}, {CategoryID: id(), Remainder: true}}}}}, "actions[1].type"},
		{"bad tag", Rule{Name: "r", Conditions: contains, Actions: []Action{{Type: ActionAddTags, Tags: []string{"Car"}}}}, "actions[0].tags[0]"},
		{"split without remainder", Rule{Name: "r", Conditions: contains, Actions: []Action{{Type: ActionSplit, Parts: []Part{{CategoryID: id(), Percent: 5000}, {CategoryID: id(), Percent: 4000}}}}}, "actions[0].parts"},
		{"split part with two shares", Rule{Name: "r", Conditions: contains, Actions: []Action{{Type: ActionSplit, Parts: []Part{{CategoryID: id(), Percent: 5000, Remainder: true}, {CategoryID: id(), Remainder: true}}}}}, "actions[0].parts[0]"},
		{"split percent at 100%", Rule{Name: "r", Conditions: contains, Actions: []Action{{Type: ActionSplit, Parts: []Part{{CategoryID: id(), Percent: 10000}, {CategoryID: id(), Remainder: true}}}}}, "actions[0].parts[0].percent"},
		{"split percents above 100%", Rule{Name: "r", Conditions: contains, Actions: []Action{{Type: ActionSplit, Parts: []Part{{CategoryID: id(), Percent: 6000}, {CategoryID: id(), Percent: 4000}, {CategoryID: id(), Remainder: true}}}}}, "actions[0].parts"},
		{"split negative amount", Rule{Name: "r", Conditions: contains, Actions: []Action{{Type: ActionSplit, Parts: []Part{{CategoryID: id(), Amount: ptr(brl(t, -1))}, {CategoryID: id(), Remainder: true}}}}}, "actions[0].parts[0].amount"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewRule(tt.r)
			fe, ok := errors.AsType[*FieldError](err)
			if !ok || fe.Field != tt.field || !errors.Is(err, ErrValidation) {
				t.Fatalf("err = %v, want field %q", err, tt.field)
			}
		})
	}
}

func TestAliasOrder(t *testing.T) {
	ifood, other, regex := id(), id(), id()
	mk := func(pattern string, mt MatchType, payee uuid.UUID) Alias {
		a, err := NewAlias(Alias{ID: id(), Pattern: pattern, MatchType: mt, PayeeID: payee})
		if err != nil {
			t.Fatal(err)
		}
		return a
	}
	aliases := []Alias{
		mk(`^IFD`, MatchRegex, regex),
		mk("ifood", MatchContains, other),
		mk("ifd*", MatchStartsWith, other),
		mk("ifd*ifood", MatchStartsWith, ifood),
		mk("IFD*IFOOD SÃO PAULO", MatchEquals, ifood),
	}
	SortAliases(aliases)
	tests := map[string]uuid.UUID{
		"IFD*IFOOD SAO PAULO": ifood, // equals beats every other type
		"IFD*IFOOD CAMPINAS":  ifood, // the longer starts_with pattern wins
		"IFD*RAPPI":           other,
		"PAG*IFOOD":           other,
		"IFDX":                regex,
	}
	for raw, want := range tests {
		if got, ok := ResolvePayee(raw, aliases); !ok || got != want {
			t.Errorf("ResolvePayee(%q) = %v, %v; want %v", raw, got, ok, want)
		}
	}
	if _, ok := ResolvePayee("UBER", aliases); ok {
		t.Error("UBER resolved to a payee")
	}
	if _, err := NewAlias(Alias{Pattern: "(", MatchType: MatchRegex, PayeeID: ifood}); err == nil {
		t.Error("invalid regex accepted")
	}
}

func TestDecideMergesRules(t *testing.T) {
	f := newRuleFixture()
	posto := mustRule(t, Rule{Priority: 1, Conditions: []Condition{{Field: FieldDescription, Operator: OpContains, Text: []string{"posto"}}},
		Actions: []Action{{Type: ActionSetCategory, CategoryID: f.fuel}}})
	shell := mustRule(t, Rule{Priority: 2, Conditions: []Condition{{Field: FieldDescription, Operator: OpContains, Text: []string{"shell"}}},
		Actions: []Action{{Type: ActionSetCategory, CategoryID: f.travel}, {Type: ActionAddTags, Tags: []string{"car"}}, {Type: ActionSetPayee, PayeeID: f.payee}}})
	s := f.subject(t, "POSTO SHELL", -15000)

	// S39: the first rule decides the category; tags and the payee come from the second.
	d := Decide(s, Catalog{Rules: []Rule{posto, shell}, Categories: f.categories})
	if d.Method != MethodRule || d.RuleID != posto.ID || !slices.Equal(d.Parts, []Allocation{{f.fuel, brl(t, 15000)}}) ||
		!slices.Equal(d.AddTags, []string{"car"}) || d.PayeeID != f.payee {
		t.Fatalf("decision = %+v", d)
	}

	posto.StopProcessing = true
	d = Decide(s, Catalog{Rules: []Rule{posto, shell}, Categories: f.categories})
	if d.RuleID != posto.ID || len(d.AddTags) != 0 || d.PayeeID != uuid.Nil {
		t.Fatalf("decision with stop = %+v", d)
	}

	closed := mustRule(t, Rule{Priority: 1, StopProcessing: true, Conditions: posto.Conditions, Actions: []Action{{Type: ActionSetCategory, CategoryID: f.closed}}})
	d = Decide(s, Catalog{Rules: []Rule{closed, shell}, Categories: f.categories})
	if d.RuleID != shell.ID || !slices.Equal(d.Parts, []Allocation{{f.travel, brl(t, 15000)}}) {
		t.Fatalf("decision with closed category = %+v", d)
	}

	if d = Decide(f.subject(t, "UBER", -1000), Catalog{Rules: []Rule{posto, shell}, Categories: f.categories}); d.Method != "" || d.Parts != nil {
		t.Fatalf("decision without match = %+v", d)
	}
}

func TestDecideAliasAndHistory(t *testing.T) {
	f := newRuleFixture()
	alias, err := NewAlias(Alias{ID: id(), Pattern: "ifd*", MatchType: MatchStartsWith, PayeeID: f.payee})
	if err != nil {
		t.Fatal(err)
	}
	history := map[HistoryKey]uuid.UUID{{PayeeID: f.payee, Class: "expense"}: f.food, {PayeeID: f.payee, Class: "income"}: f.salary}
	c := Catalog{Aliases: []Alias{alias}, Categories: f.categories, History: history}

	d := Decide(f.subject(t, "IFD*IFOOD SAO PAULO", -4500), c)
	if d.PayeeID != f.payee || d.Method != MethodHistory || !slices.Equal(d.Parts, []Allocation{{f.food, brl(t, 4500)}}) {
		t.Fatalf("decision = %+v", d)
	}

	refund := f.subject(t, "IFD*IFOOD SAO PAULO", 4500)
	refund.Class = "income"
	if d = Decide(refund, c); !slices.Equal(d.Parts, []Allocation{{f.salary, brl(t, -4500)}}) {
		t.Fatalf("income decision = %+v", d)
	}

	if d = Decide(f.subject(t, "PADARIA", -4500), c); d.PayeeID != uuid.Nil || d.Method != "" {
		t.Fatalf("decision without payee = %+v", d)
	}

	known := f.subject(t, "IFD*IFOOD", -4500)
	known.PayeeID = id()
	if d = Decide(known, c); d.PayeeID != uuid.Nil || d.Method != "" {
		t.Fatalf("a transaction with a payee got %+v", d)
	}
}

func TestAllocate(t *testing.T) {
	f := newRuleFixture()
	split := []Part{{CategoryID: f.groceries, Percent: 8000}, {CategoryID: f.cleaning, Remainder: true}}
	tests := []struct {
		name  string
		total int64
		parts []Part
		want  []Allocation
		ok    bool
	}{
		{"S40", 9999, split, []Allocation{{f.groceries, brl(t, 7999)}, {f.cleaning, brl(t, 2000)}}, true},
		{"negative total", -9999, split, []Allocation{{f.groceries, brl(t, -7999)}, {f.cleaning, brl(t, -2000)}}, true},
		{"one cent goes to the remainder", 1, split, []Allocation{{f.cleaning, brl(t, 1)}}, true},
		{"a third", 10000, []Part{{CategoryID: f.groceries, Percent: 3333}, {CategoryID: f.food, Percent: 3333}, {CategoryID: f.cleaning, Remainder: true}},
			[]Allocation{{f.groceries, brl(t, 3333)}, {f.food, brl(t, 3333)}, {f.cleaning, brl(t, 3334)}}, true},
		{"fixed and remainder", 25000, []Part{{CategoryID: f.food, Amount: ptr(brl(t, 5000))}, {CategoryID: f.cleaning, Remainder: true}},
			[]Allocation{{f.food, brl(t, 5000)}, {f.cleaning, brl(t, 20000)}}, true},
		{"fixed above total", 4000, []Part{{CategoryID: f.food, Amount: ptr(brl(t, 5000))}, {CategoryID: f.cleaning, Remainder: true}}, nil, false},
		{"closed category", 4000, []Part{{CategoryID: f.closed, Percent: 5000}, {CategoryID: f.cleaning, Remainder: true}}, nil, false},
		{"unknown category", 4000, []Part{{CategoryID: id(), Remainder: true}}, nil, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := Allocate(brl(t, tt.total), tt.parts, f.categories, day("2026-10-14"))
			if ok != tt.ok || !slices.Equal(got, tt.want) {
				t.Fatalf("Allocate = %v, %v; want %v, %v", got, ok, tt.want, tt.ok)
			}
		})
	}
}

// Every split of every total sums to the total without zero parts (Review Focus 5).
func TestAllocateSumsToTotal(t *testing.T) {
	f := newRuleFixture()
	rng := rand.New(rand.NewPCG(1, 2))
	cats := []uuid.UUID{f.food, f.groceries, f.cleaning, f.travel, f.fuel}
	for range 5000 {
		total := rng.Int64N(1<<53) - 1<<52
		if rng.IntN(2) == 0 {
			total = rng.Int64N(20001) - 10000
		}
		if total == 0 {
			continue
		}
		n := 1 + rng.IntN(4)
		parts := make([]Part, 0, n+1)
		left := 9999
		for i := range n {
			if left == 0 {
				break
			}
			p := 1 + rng.IntN(left)
			left -= p
			parts = append(parts, Part{CategoryID: cats[i], Percent: p})
		}
		parts = append(parts, Part{CategoryID: cats[4], Remainder: true})
		got, ok := Allocate(brl(t, total), parts, f.categories, day("2026-10-14"))
		if !ok {
			t.Fatalf("Allocate(%d, %+v) failed", total, parts)
		}
		var sum int64
		for _, a := range got {
			if a.Amount.IsZero() || a.Amount.IsNegative() != (total < 0) {
				t.Fatalf("Allocate(%d, %+v) = %v", total, parts, got)
			}
			sum += a.Amount.Amount()
		}
		if sum != total {
			t.Fatalf("Allocate(%d, %+v) sums to %d", total, parts, sum)
		}
	}
}

func TestMatchKey(t *testing.T) {
	payee := id()
	if got := MatchKey(payee, "IFD*IFOOD"); got != "payee:"+payee.String() {
		t.Errorf("with payee = %q", got)
	}
	if got := MatchKey(uuid.Nil, " PADARIA  SÃO JOÃO "); got != "description:padaria sao joao" {
		t.Errorf("without payee = %q", got)
	}
	category := id()
	conditions, actions := SuggestedRule(MatchKey(uuid.Nil, "PADARIA SÃO JOÃO"), category)
	if _, err := NewRule(Rule{Name: "r", Conditions: conditions, Actions: actions}); err != nil || conditions[0].Field != FieldRawDescription || conditions[0].Text[0] != "padaria sao joao" {
		t.Errorf("suggested rule = %+v, %+v: %v", conditions, actions, err)
	}
	conditions, _ = SuggestedRule(MatchKey(payee, "IFD*IFOOD"), category)
	if conditions[0].Field != FieldPayee || conditions[0].IDs[0] != payee {
		t.Errorf("suggested rule with payee = %+v", conditions)
	}
}
