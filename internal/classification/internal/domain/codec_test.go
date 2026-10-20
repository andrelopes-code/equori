package domain

import (
	"encoding/json/v2"
	"errors"
	"reflect"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// Conditions and actions survive the JSON form stored in jsonb and sent over HTTP.
func TestRuleDocsRoundTrip(t *testing.T) {
	t.Parallel()
	r := mustRule(t, Rule{
		Conditions: []Condition{
			{Field: FieldDescription, Operator: OpRegex, Text: []string{`^UBER`}},
			{Field: FieldRawDescription, Operator: OpInList, Text: []string{"a", "b"}},
			{Field: FieldPayee, Operator: OpEquals, IDs: []uuid.UUID{id()}},
			{Field: FieldAmount, Operator: OpBetween, Money: []money.Money{brl(t, -5000), brl(t, -100)}},
			{Field: FieldDayOfMonth, Operator: OpInList, Ints: []int{1, 15}},
			{Field: FieldInstallment, Operator: OpEquals, Bool: true},
			{Field: FieldWeekday, Operator: OpEquals, Text: []string{"friday"}},
		},
		Actions: []Action{
			{Type: ActionSplit, Parts: []Part{{CategoryID: id(), Percent: 2500}, {CategoryID: id(), Amount: ptr(brl(t, 1000))}, {CategoryID: id(), Remainder: true}}},
			{Type: ActionAddTags, Tags: []string{"car"}},
			{Type: ActionSetPayee, PayeeID: id()},
		},
	})
	conditions := make([]ConditionDoc, len(r.Conditions))
	for i, c := range r.Conditions {
		conditions[i] = c.Doc()
	}
	actions := make([]ActionDoc, len(r.Actions))
	for i, a := range r.Actions {
		actions[i] = a.Doc()
	}
	raw, err := json.Marshal(struct {
		C []ConditionDoc
		A []ActionDoc
	}{conditions, actions})
	if err != nil {
		t.Fatal(err)
	}
	var decoded struct {
		C []ConditionDoc
		A []ActionDoc
	}
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	got, err := RuleFromDocs(Rule{ID: r.ID, Name: r.Name, Enabled: true}, decoded.C, decoded.A)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, r) {
		t.Fatalf("round trip = %+v\nwant %+v", got, r)
	}
}

func TestConditionFromDocRejections(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		doc  ConditionDoc
	}{
		{"list operator without array", ConditionDoc{Field: "description", Operator: "in_list", Value: "x"}},
		{"payee not an id", ConditionDoc{Field: "payee", Operator: "equals", Value: "iFood"}},
		{"amount as number", ConditionDoc{Field: "amount", Operator: "equals", Value: float64(10)}},
		{"amount with extra member", ConditionDoc{Field: "amount", Operator: "equals", Value: map[string]any{"amount": float64(1), "currency": "BRL", "x": 1}}},
		{"fractional day", ConditionDoc{Field: "day_of_month", Operator: "equals", Value: 1.5}},
		{"installment as string", ConditionDoc{Field: "installment", Operator: "equals", Value: "true"}},
		{"text as number", ConditionDoc{Field: "description", Operator: "equals", Value: float64(1)}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ConditionFromDoc("conditions[0]", tt.doc)
			fe, ok := errors.AsType[*FieldError](err)
			if !ok || fe.Field != "conditions[0].value" {
				t.Fatalf("err = %v", err)
			}
		})
	}
}
