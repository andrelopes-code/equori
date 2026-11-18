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
	case "create_goal", "update_goal", "delete_goal", "link_expense", "unlink_expense", "allocate":
		err = checkGoalFields(name, fields)
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
		err = required(name, fields, []string{"buckets"}, "month")
	case "move_category":
		err = required(name, fields, []string{"category_id", "bucket"})
	}

	return err
}

// checkGoalFields checks the fields of the actions over a goal.
func checkGoalFields(name string, fields []field) error {
	var err error

	switch name {
	case "create_goal":
		err = required(
			name,
			fields,
			[]string{"name", "amount", "due_on", "account_ids"},
			"counts_as_savings",
			"allocated",
		)
	case "update_goal":
		err = required(
			name,
			fields,
			[]string{"goal_id"},
			"name",
			"amount",
			"due_on",
			"account_ids",
			"counts_as_savings",
			"allocated",
		)
	case "delete_goal":
		err = required(name, fields, []string{"goal_id"})
	case "link_expense", "unlink_expense":
		err = required(name, fields, []string{"goal_id", "transaction_id"})
	case "allocate":
		err = required(name, fields, []string{"goal_id", "account_ids", "amount"})
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
		{"transaction_id", in.TransactionID != ""},
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
		{"counts_as_savings", in.CountsAsSavings.Set},
		{"allocated", in.Allocated},
		{
			"source",
			in.Source != "",
		},
		{"amounts", len(in.Amounts) > 0},
		{"savings_target_bp", in.SavingsTargetBP.Set},
		// An empty list removes the split, so presence is the field set, not its length.
		{"buckets", in.Buckets != nil},
		{"bucket", in.Bucket != ""},
	}
}
