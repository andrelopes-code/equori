package domain

import "testing"

// Coverage row E-06: a posting outside the balancing currency holds a zero weight only on the
// units a right issue gives at no cost, or on an outflow, which takes the cost it finds.
func TestZeroWeight(t *testing.T) {
	t.Parallel()
	f := newTxFixture(t)

	rightIssue := &CorporateAction{Kind: ActionRightIssue, NewAccountID: f.wise.ID}

	tests := []struct {
		name   string
		amount int64
		action *CorporateAction
		ok     bool
	}{
		{"inflow", 100, nil, false},
		{"inflow of a right issue", 100, rightIssue, true},
		{
			"inflow of a spin-off",
			100,
			&CorporateAction{Kind: ActionSpinOff, NewAccountID: f.wise.ID},
			false,
		},
		{"outflow", -100, nil, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			tx := f.tx(
				Posting{
					AccountID: f.wise.ID,
					Amount:    mustMoney(t, tc.amount, "USD"),
					Weight:    brl(t, 0),
				},
				Posting{AccountID: f.checking.ID, Amount: brl(t, 1)},
				Posting{AccountID: f.food.ID, Amount: brl(t, -1)},
			)
			tx.CorporateAction = tc.action

			_, err := NewTransaction(tx, f.accounts)

			if (err == nil) != tc.ok {
				t.Errorf("err = %v, want ok %v", err, tc.ok)
			}
		})
	}
}
