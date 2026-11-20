package toolapi

import "strings"

// undoBudgetOrGoal is the exact inverse of a budget or goal write (answer views design V19):
// deleting what a create made, unlinking what a link linked, and releasing what an allocation set
// aside. Changes, deletions and plans have none.
func undoBudgetOrGoal(
	in manageBudgetOrGoalIn,
	out manageBudgetOrGoalOut,
	_ string,
) (string, any, bool) {
	inverse := manageBudgetOrGoalIn{GoalID: in.GoalID}

	switch in.Action {
	case "create_budget":
		inverse = manageBudgetOrGoalIn{Action: "delete_budget", BudgetID: out.BudgetID}
	case "create_goal":
		inverse.Action, inverse.GoalID = "delete_goal", out.GoalID
	case "link_expense":
		inverse.Action, inverse.TransactionID = "unlink_expense", in.TransactionID
	case "unlink_expense":
		inverse.Action, inverse.TransactionID = "link_expense", in.TransactionID
	case "allocate":
		inverse.Action, inverse.AccountIDs, inverse.Amount = "allocate", in.AccountIDs, negated(
			in.Amount,
		)
	default:
		return "", nil, false
	}

	return "manage_budget_or_goal", inverse, true
}

// undoOccurrence releases the transaction realize linked, and reopens the occurrence skip skipped.
func undoOccurrence(in manageOccurrenceIn, _ manageOccurrenceOut, _ string) (string, any, bool) {
	inverse := manageOccurrenceIn{OccurrenceID: in.OccurrenceID}

	switch in.Action {
	case "realize":
		inverse.Action = "unrealize"
	case "skip":
		inverse.Action = "reopen"
	default:
		return "", nil, false
	}

	return "manage_occurrence", inverse, true
}

// negated returns the decimal amount with the opposite sign.
func negated(amount string) string {
	if rest, ok := strings.CutPrefix(amount, "-"); ok {
		return rest
	}

	return "-" + amount
}
