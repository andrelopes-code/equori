package toolapi

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// ruleFields are the fields create_rule and change_rule accept beside their identifiers.
var ruleFields = []string{
	"name",
	"description_contains",
	"category_id",
	"payee_id",
	"conditions",
	"actions",
	"enabled",
	"stop_processing",
}

// ruleForm tells which of the two ways to write a rule a call used.
type ruleForm struct{ simple, structured bool }

func formOf(in manageRuleIn) ruleForm {
	return ruleForm{
		simple:     in.DescriptionContains != "" || in.CategoryID != "" || in.PayeeID != "",
		structured: len(in.Conditions) > 0 || len(in.Actions) > 0,
	}
}

// checkRuleForm validates how a create_rule or change_rule call combines its fields.
func checkRuleForm(in manageRuleIn) error {
	f := formOf(in)
	if f.simple && f.structured {
		return tool.InvalidArgument(firstGiven(in), "is not used beside conditions or actions")
	}

	create := in.Action == "create_rule"
	switch {
	case f.simple && (in.DescriptionContains == "" || in.CategoryID == ""):
		return tool.InvalidArgument(
			missing(in.DescriptionContains, "description_contains", "category_id"),
			"is required with the other of the pair",
		)
	case f.structured && create && (len(in.Conditions) == 0 || len(in.Actions) == 0):
		return tool.InvalidArgument(
			missing(len(in.Conditions) > 0, "conditions", "actions"),
			"is required for create_rule",
		)
	case create && !f.simple && !f.structured:
		return tool.InvalidArgument(
			"conditions",
			"and actions, or description_contains and category_id, are required for create_rule",
		)
	case !create && !f.simple && !f.structured && in.Name == "" && !in.Enabled.Set && !in.StopProcessing.Set:
		return tool.InvalidArgument(
			"name",
			"or another field to change is required for change_rule",
		)
	}

	return nil
}

func firstGiven(in manageRuleIn) string {
	switch {
	case in.DescriptionContains != "":
		return "description_contains"
	case in.CategoryID != "":
		return "category_id"
	}

	return "payee_id"
}

// missing names the field a pair lacks: first when given is false, otherwise second.
func missing[T comparable](given T, first, second string) string {
	var zero T
	if given == zero {
		return first
	}

	return second
}

// buildRule applies a create_rule or change_rule call to old, the rule to change; a zero old
// starts a new rule. A call that names no conditions or actions keeps the ones old has.
func buildRule(in manageRuleIn, p ids, old domain.Rule) (domain.Rule, error) {
	r := old
	if r.ID == uuid.Nil && in.Action == "create_rule" {
		r.Enabled = true
	}

	if in.Name != "" {
		r.Name = in.Name
	}

	if in.Enabled.Set {
		r.Enabled = in.Enabled.B
	}

	if in.StopProcessing.Set {
		r.StopProcessing = in.StopProcessing.B
	}

	conditions, actions, err := ruleDocs(in, p)
	if err != nil {
		return domain.Rule{}, err
	}

	if conditions != nil {
		r.Conditions = make([]domain.Condition, len(conditions))
		for i, d := range conditions {
			if r.Conditions[i], err = domain.ConditionFromDoc(
				fmt.Sprintf("conditions[%d]", i),
				d,
			); err != nil {
				return domain.Rule{}, err
			}
		}
	}

	if actions != nil {
		r.Actions = make([]domain.Action, len(actions))
		for i, d := range actions {
			if r.Actions[i], err = domain.ActionFromDoc(
				fmt.Sprintf("actions[%d]", i),
				d,
			); err != nil {
				return domain.Rule{}, err
			}
		}
	}

	return domain.NewRule(r)
}

// ruleDocs returns the conditions and actions the call writes; nil means the call leaves them.
func ruleDocs(in manageRuleIn, p ids) ([]domain.ConditionDoc, []domain.ActionDoc, error) {
	if formOf(in).simple {
		actions := []domain.ActionDoc{
			{Type: string(domain.ActionSetCategory), CategoryID: p.category},
		}
		if p.payee != uuid.Nil {
			actions = append(
				actions,
				domain.ActionDoc{Type: string(domain.ActionSetPayee), PayeeID: p.payee},
			)
		}

		return []domain.ConditionDoc{
			{
				Field:    string(domain.FieldDescription),
				Operator: string(domain.OpContains),
				Value:    in.DescriptionContains,
			},
		}, actions, nil
	}

	var conditions []domain.ConditionDoc

	for i, c := range in.Conditions {
		d, err := parseCondition(i, c)
		if err != nil {
			return nil, nil, err
		}

		conditions = append(conditions, d)
	}

	var actions []domain.ActionDoc

	for i, a := range in.Actions {
		d, err := parseAction(i, a)
		if err != nil {
			return nil, nil, err
		}

		actions = append(actions, d)
	}

	return conditions, actions, nil
}

// parseCondition reads "field operator value"; between and in_list read values joined by " | ".
func parseCondition(i int, s string) (domain.ConditionDoc, error) {
	bad := func(msg string) (domain.ConditionDoc, error) {
		return domain.ConditionDoc{}, tool.InvalidArgument(
			"conditions",
			fmt.Sprintf("[%d] %s", i, msg),
		)
	}

	parts := strings.SplitN(strings.TrimSpace(s), " ", 3)
	if len(parts) < 3 || strings.TrimSpace(parts[2]) == "" {
		return bad(`must read "field operator value"`)
	}

	field, op, rest := parts[0], parts[1], strings.TrimSpace(parts[2])
	raw := []string{rest}

	list := op == string(domain.OpBetween) || op == string(domain.OpInList)
	if list {
		raw = strings.Split(rest, " | ")
	}

	values := make([]any, len(raw))
	for j, r := range raw {
		v, err := conditionItem(field, strings.TrimSpace(r))
		if err != nil {
			return bad(fmt.Sprintf("value %q: %s", r, err))
		}

		values[j] = v
	}

	d := domain.ConditionDoc{Field: field, Operator: op, Value: values[0]}
	if list {
		d.Value = values
	}

	return d, nil
}

// parseAction reads "type target": an ID, or comma-separated tags for add_tags.
func parseAction(i int, s string) (domain.ActionDoc, error) {
	typ, target, _ := strings.Cut(strings.TrimSpace(s), " ")
	d := domain.ActionDoc{Type: typ}

	if typ == string(domain.ActionAddTags) {
		for t := range strings.SplitSeq(target, ",") {
			d.Tags = append(d.Tags, strings.TrimSpace(t))
		}

		return d, nil
	}

	id, err := optionalID(strings.TrimSpace(target), fmt.Sprintf("actions[%d]", i))
	if err != nil {
		return domain.ActionDoc{}, err
	}

	switch typ {
	case string(domain.ActionSetCategory):
		d.CategoryID = id
	case string(domain.ActionSetPayee):
		d.PayeeID = id
	default:
		d.AccountID = id
	}

	return d, nil
}

func conditionItem(field, s string) (any, error) {
	switch domain.Field(field) {
	case domain.FieldAmount, domain.FieldAbsoluteAmount:
		return moneyCondition(s)
	case domain.FieldDayOfMonth:
		n, err := strconv.Atoi(s)
		if err != nil {
			return nil, fmt.Errorf("must be a day number")
		}

		return float64(n), nil
	case domain.FieldInstallment:
		b, err := strconv.ParseBool(s)
		if err != nil {
			return nil, fmt.Errorf("must be true or false")
		}

		return b, nil
	}

	return s, nil
}

func moneyCondition(s string) (domain.MoneyDoc, error) {
	parts := strings.Fields(s)

	bad := fmt.Errorf("must be an amount and a currency, such as 10.00 BRL")
	if len(parts) != 2 {
		return domain.MoneyDoc{}, bad
	}

	cur, err := money.ParseCurrency(parts[1])
	if err != nil {
		return domain.MoneyDoc{}, bad
	}

	unit, err := money.New(0, cur)
	if err != nil {
		return domain.MoneyDoc{}, bad
	}

	m, err := tool.ParseAmount("conditions", parts[0], unit)
	if err != nil {
		return domain.MoneyDoc{}, bad
	}

	return domain.MoneyDoc{Amount: m.Amount(), Currency: string(cur)}, nil
}
