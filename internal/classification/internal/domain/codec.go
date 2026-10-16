package domain

import (
	"fmt"
	"math"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

// ConditionDoc is the stored and transported form of a condition: the value is a JSON
// value whose type the field selects; between and in_list take an array.
type ConditionDoc struct {
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Value    any    `json:"value"`
}

type MoneyDoc struct {
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
}

type PartDoc struct {
	CategoryID uuid.UUID `json:"category_id"`
	Percent    int       `json:"percent,omitempty"`
	Amount     *MoneyDoc `json:"amount,omitempty"`
	Remainder  bool      `json:"remainder,omitempty"`
}

type ActionDoc struct {
	Type       string    `json:"type"`
	CategoryID uuid.UUID `json:"category_id,omitzero"`
	PayeeID    uuid.UUID `json:"payee_id,omitzero"`
	AccountID  uuid.UUID `json:"account_id,omitzero"`
	Tags       []string  `json:"tags,omitempty"`
	Parts      []PartDoc `json:"parts,omitempty"`
}

// Doc returns the transported form of c.
func (c Condition) Doc() ConditionDoc {
	d := ConditionDoc{Field: string(c.Field), Operator: string(c.Operator)}
	var values []any
	switch c.Field {
	case FieldPayee, FieldAccount:
		for _, id := range c.IDs {
			values = append(values, id.String())
		}
	case FieldAmount, FieldAbsoluteAmount:
		for _, m := range c.Money {
			values = append(values, MoneyDoc{Amount: m.Amount(), Currency: string(m.Currency())})
		}
	case FieldDayOfMonth:
		for _, n := range c.Ints {
			values = append(values, n)
		}
	case FieldInstallment:
		values = []any{c.Bool}
	default:
		for _, t := range c.Text {
			values = append(values, t)
		}
	}
	if c.Operator == OpBetween || c.Operator == OpInList {
		d.Value = values
	} else if len(values) > 0 {
		d.Value = values[0]
	}
	return d
}

// ConditionFromDoc reads d as decoded from JSON (numbers as float64, objects as maps);
// field prefixes the paths of the errors. NewRule validates the result.
func ConditionFromDoc(field string, d ConditionDoc) (Condition, error) {
	c := Condition{Field: Field(d.Field), Operator: Operator(d.Operator)}
	values := []any{d.Value}
	if c.Operator == OpBetween || c.Operator == OpInList {
		list, ok := d.Value.([]any)
		if !ok {
			return Condition{}, invalid(field+".value", "must be an array")
		}
		values = list
	}
	bad := func(want string) (Condition, error) { return Condition{}, invalid(field+".value", "must be "+want) }
	for _, v := range values {
		switch c.Field {
		case FieldPayee, FieldAccount:
			s, ok := v.(string)
			id, err := uuid.Parse(s)
			if !ok || err != nil {
				return bad("an id")
			}
			c.IDs = append(c.IDs, id)
		case FieldAmount, FieldAbsoluteAmount:
			m, ok := moneyValue(v)
			if !ok {
				return bad("money")
			}
			c.Money = append(c.Money, m)
		case FieldDayOfMonth:
			n, ok := integer(v)
			if !ok {
				return bad("an integer")
			}
			c.Ints = append(c.Ints, int(n))
		case FieldInstallment:
			b, ok := v.(bool)
			if !ok {
				return bad("a boolean")
			}
			c.Bool = b
		default:
			s, ok := v.(string)
			if !ok {
				return bad("a string")
			}
			c.Text = append(c.Text, s)
		}
	}
	return c, nil
}

func integer(v any) (int64, bool) {
	f, ok := v.(float64)
	if !ok || f != math.Trunc(f) || math.Abs(f) > 1<<53 {
		return 0, false
	}
	return int64(f), true
}

func moneyValue(v any) (money.Money, bool) {
	switch m := v.(type) {
	case MoneyDoc:
		out, err := money.New(m.Amount, money.Currency(m.Currency))
		return out, err == nil
	case map[string]any:
		amount, ok := integer(m["amount"])
		currency, isString := m["currency"].(string)
		if !ok || !isString || len(m) != 2 {
			return money.Money{}, false
		}
		out, err := money.New(amount, money.Currency(currency))
		return out, err == nil
	}
	return money.Money{}, false
}

// Doc returns the transported form of a.
func (a Action) Doc() ActionDoc {
	d := ActionDoc{Type: string(a.Type), CategoryID: a.CategoryID, PayeeID: a.PayeeID, AccountID: a.AccountID, Tags: a.Tags}
	for _, p := range a.Parts {
		pd := PartDoc{CategoryID: p.CategoryID, Percent: p.Percent, Remainder: p.Remainder}
		if p.Amount != nil {
			pd.Amount = &MoneyDoc{Amount: p.Amount.Amount(), Currency: string(p.Amount.Currency())}
		}
		d.Parts = append(d.Parts, pd)
	}
	return d
}

// ActionFromDoc reads d; field prefixes the paths of the errors.
func ActionFromDoc(field string, d ActionDoc) (Action, error) {
	a := Action{Type: ActionType(d.Type), CategoryID: d.CategoryID, PayeeID: d.PayeeID, AccountID: d.AccountID, Tags: d.Tags}
	for i, pd := range d.Parts {
		p := Part{CategoryID: pd.CategoryID, Percent: pd.Percent, Remainder: pd.Remainder}
		if pd.Amount != nil {
			m, err := money.New(pd.Amount.Amount, money.Currency(pd.Amount.Currency))
			if err != nil {
				return Action{}, invalid(fmt.Sprintf("%s.parts[%d].amount", field, i), "must be money in a supported currency")
			}
			p.Amount = &m
		}
		a.Parts = append(a.Parts, p)
	}
	return a, nil
}

// RuleFromDocs builds r's conditions and actions from their transported forms and
// validates the rule with NewRule.
func RuleFromDocs(r Rule, conditions []ConditionDoc, actions []ActionDoc) (Rule, error) {
	r.Conditions = make([]Condition, len(conditions))
	for i, d := range conditions {
		c, err := ConditionFromDoc(fmt.Sprintf("conditions[%d]", i), d)
		if err != nil {
			return Rule{}, err
		}
		r.Conditions[i] = c
	}
	r.Actions = make([]Action, len(actions))
	for i, d := range actions {
		a, err := ActionFromDoc(fmt.Sprintf("actions[%d]", i), d)
		if err != nil {
			return Rule{}, err
		}
		r.Actions[i] = a
	}
	return NewRule(r)
}
