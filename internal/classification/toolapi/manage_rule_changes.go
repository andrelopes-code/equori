package toolapi

import (
	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// ruleChanges lists the fields a create_rule or change_rule call sets. The simple form shows the
// text and the category it was given; the structured form shows the rendered conditions and actions.
func ruleChanges(in manageRuleIn, p ids, old, rule domain.Rule, categories, payees map[uuid.UUID]string) []tool.Change {
	text := tool.TextValue
	create := in.Action == "create_rule"
	f := formOf(in)

	var changes []tool.Change

	if create || in.Name != "" {
		c := tool.Change{Field: "name", After: text(rule.Name)}
		if !create {
			c.Before = text(old.Name)
		}

		changes = append(changes, c)
	}

	if create || f.simple || len(in.Conditions) > 0 {
		pattern := text(conditionsText(rule.Conditions))
		if f.simple {
			pattern = text(in.DescriptionContains)
		}

		c := tool.Change{Field: "pattern", After: pattern}
		if !create {
			c.Before = text(conditionsText(old.Conditions))
		}

		changes = append(changes, c)
	}

	if create || f.simple || len(in.Actions) > 0 {
		category := text(actionsText(rule.Actions, categories, payees))
		if f.simple {
			category = text(categories[p.category])
		}

		c := tool.Change{Field: "category", After: category}
		if !create {
			c.Before = text(actionsText(old.Actions, categories, payees))
		}

		changes = append(changes, c)
	}

	if f.simple && in.PayeeID != "" {
		changes = append(changes, tool.Change{Field: "payee", After: text(payees[p.payee])})
	}

	if in.Enabled.Set || in.StopProcessing.Set {
		c := tool.Change{Field: "status", After: text(ruleStatus(rule))}
		if !create {
			c.Before = text(ruleStatus(old))
		}

		changes = append(changes, c)
	}

	return changes
}

func ruleStatus(r domain.Rule) string {
	s := "disabled"
	if r.Enabled {
		s = "enabled"
	}

	if r.StopProcessing {
		s += ", stops later rules"
	}

	return s
}
