package toolapi

func checkBudgetGoalFields(in manageBudgetOrGoalIn) error {
	fields := budgetGoalFields(in)
	name := string(in.Action)

	var err error
	switch in.Action {
	case "create_budget":
		err = required(name, fields, []string{"category_id", "amount", "month"}, "rollover")
	case "set_budget_amount":
		err = required(name, fields, []string{"budget_id", "amount", "month"})
	case "delete_budget":
		err = required(name, fields, []string{"budget_id"})
	case "create_goal":
		err = required(name, fields, []string{"name", "amount", "due_on", "account_ids"})
	case "update_goal":
		err = required(name, fields, []string{"goal_id"}, "name", "amount", "due_on", "account_ids")
	case "delete_goal":
		err = required(name, fields, []string{"goal_id"})
	case "save_plan":
		err = required(
			name,
			fields,
			[]string{"month", "amounts"},
			"source",
			"amount",
			"savings_target_bp",
		)
	case "save_buckets":
		err = required(name, fields, []string{"buckets"})
	}

	return err
}

func budgetGoalFields(in manageBudgetOrGoalIn) []field {
	return []field{
		{
			"budget_id",
			in.BudgetID != "",
		},
		{"goal_id", in.GoalID != ""},
		{"category_id", in.CategoryID != ""},
		{
			"amount",
			in.Amount != "",
		},
		{"month", in.Month != ""},
		{"rollover", in.Rollover},
		{"name", in.Name != ""},
		{"due_on", !in.DueOn.IsZero()},
		{"account_ids", len(in.AccountIDs) > 0},
		{
			"source",
			in.Source != "",
		},
		{"amounts", len(in.Amounts) > 0},
		{"savings_target_bp", in.SavingsTargetBP.Set},
		{"buckets", len(in.Buckets) > 0},
	}
}
