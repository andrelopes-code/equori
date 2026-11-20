package toolapi

// undoReview undoes the confirmation or the dismissal of an investment movement (answer views
// design V19).
func undoReview(in reviewInvestmentMovementIn, _ struct{}, _ string) (string, any, bool) {
	if in.Action != "confirm" && in.Action != "dismiss" {
		return "", nil, false
	}

	return "review_investment_movement", reviewInvestmentMovementIn{
		Action:     "undo",
		MovementID: in.MovementID,
	}, true
}
