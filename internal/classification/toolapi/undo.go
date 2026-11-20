package toolapi

// undoRule deletes the rule create_rule created and the alias create_alias created (answer views
// design V19); every other rule write has no exact inverse.
func undoRule(in manageRuleIn, out manageRuleOut, _ string) (string, any, bool) {
	switch {
	case in.Action == "create_rule" && out.RuleID != "":
		return "manage_rule", manageRuleIn{Action: "delete_rule", RuleID: out.RuleID}, true
	case in.Action == "create_alias" && out.AliasID != "":
		return "manage_rule", manageRuleIn{Action: "delete_alias", AliasID: out.AliasID}, true
	}

	return "", nil, false
}
