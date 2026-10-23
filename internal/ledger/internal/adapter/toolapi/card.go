package toolapi

import (
	"context"
	"regexp"
	"strconv"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type manageCardAction string

func (manageCardAction) Values() []string {
	return []string{"add_card", "set_card_active", "set_credit_limit", "set_billing_cycle"}
}

type manageCardIn struct {
	AccountID     string           `json:"account_id" jsonschema:"credit card account, from list_accounts"`
	Action        manageCardAction `json:"action" jsonschema:"operation to propose"`
	CardID        string           `json:"card_id,omitzero" jsonschema:"for set_card_active: card from get_account_details"`
	Holder        string           `json:"holder,omitzero" jsonschema:"for add_card: name printed on the card"`
	LastFour      string           `json:"last_four,omitzero" jsonschema:"for add_card: last four digits"`
	Virtual       bool             `json:"virtual,omitzero" jsonschema:"for add_card: the card is virtual"`
	Active        bool             `json:"active,omitzero" jsonschema:"for set_card_active: true activates, false deactivates"`
	Amount        string           `json:"amount,omitzero" jsonschema:"for set_credit_limit: positive limit in the card's currency"`
	EffectiveFrom tool.Date        `json:"effective_from,omitzero" jsonschema:"for set_credit_limit: first date of the limit; for set_billing_cycle: any date of the first statement month it applies to"`
	ClosingDay    int              `json:"closing_day,omitzero" jsonschema:"for set_billing_cycle: day of the month the statement closes"`
	DueDay        int              `json:"due_day,omitzero" jsonschema:"for set_billing_cycle: day of the month the statement is due"`
}

type manageCardOut struct {
	AccountID string `json:"account_id"`
	Action    string `json:"action"`
	ID        string `json:"id"`
}

var lastFourPattern = regexp.MustCompile(`^[0-9]{4}$`)

func manageCard(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "manage_card",
		Description: "Proposes a change to a credit card account's setup: add a plastic or virtual card, activate or deactivate one, set a new credit limit or a new billing cycle. " +
			"Use it when the user changes card details. " +
			"Do not use it for purchases or statements: handle_card_purchase and settle_statement do. " +
			"The user confirms every change.",
		Effect: tool.Write,
	}, func(ctx context.Context, userID int64, in manageCardIn) (tool.Preview, error) {
		pv, _, err := planCard(ctx, svc, userID, in)
		return pv, err
	}, func(ctx context.Context, userID int64, in manageCardIn) (manageCardOut, error) {
		_, run, err := planCard(ctx, svc, userID, in)
		if err != nil {
			return manageCardOut{}, err
		}
		return run()
	})
}

func cardText(c domain.Card) string { return c.Holder + " " + c.LastFour }

func planCard(ctx context.Context, svc *app.Service, userID int64, in manageCardIn) (tool.Preview, func() (manageCardOut, error), error) {
	action := string(in.Action)
	pv := tool.Preview{Action: "manage_card"}
	id, err := requiredID(in.AccountID, "account_id")
	if err != nil {
		return pv, nil, err
	}
	cardID, err := optionalID(in.CardID, "card_id")
	if err != nil {
		return pv, nil, err
	}
	given := map[string]bool{
		"account_id": true, "card_id": in.CardID != "", "holder": in.Holder != "", "last_four": in.LastFour != "", "virtual": in.Virtual, "active": in.Active,
		"amount": in.Amount != "", "effective_from": !in.EffectiveFrom.IsZero(), "closing_day": in.ClosingDay != 0, "due_day": in.DueDay != 0,
	}
	var required, optional []string
	switch in.Action {
	case "add_card":
		required, optional = []string{"holder", "last_four"}, []string{"virtual"}
	case "set_card_active":
		required, optional = []string{"card_id"}, []string{"active"}
	case "set_credit_limit":
		required = []string{"amount", "effective_from"}
	default:
		required = []string{"closing_day", "due_day", "effective_from"}
	}
	if err := checkFields(action, given, append([]string{"account_id"}, required...), optional...); err != nil {
		return pv, nil, err
	}
	a, err := svc.Account(ctx, userID, id)
	if err != nil {
		return pv, nil, err
	}
	if a.Kind != domain.KindCreditCard {
		return pv, nil, tool.InvalidArgument("account_id", "is not a credit card account")
	}
	pv.Target = a.Name
	out := manageCardOut{AccountID: a.ID.String(), Action: action}
	switch in.Action {
	case "add_card":
		if !lastFourPattern.MatchString(in.LastFour) {
			return pv, nil, tool.InvalidArgument("last_four", "must be four digits")
		}
		c := domain.Card{AccountID: a.ID, Holder: in.Holder, LastFour: in.LastFour, Virtual: in.Virtual}
		pv.Changes = []tool.Change{{Field: "card", After: tool.TextValue(cardText(c))}}
		return pv, func() (manageCardOut, error) {
			created, err := svc.AddCard(ctx, userID, c, nil)
			out.ID = created.ID.String()
			return out, err
		}, nil
	case "set_card_active":
		cards, err := svc.Cards(ctx, userID, a.ID)
		if err != nil {
			return pv, nil, err
		}
		for _, c := range cards {
			if c.ID != cardID {
				continue
			}
			status := func(active bool) tool.Value {
				if active {
					return tool.TextValue("active")
				}
				return tool.TextValue("inactive")
			}
			pv.Changes = []tool.Change{
				{Field: "card", After: tool.TextValue(cardText(c))},
				{Field: "status", Before: status(c.Active), After: status(in.Active)},
			}
			return pv, func() (manageCardOut, error) {
				_, err := svc.SetCardActive(ctx, userID, c.ID, in.Active)
				out.ID = c.ID.String()
				return out, err
			}, nil
		}
		return pv, nil, app.ErrNotFound
	case "set_credit_limit":
		unit, err := svc.AmountOf(ctx, 0, a.Instrument)
		if err != nil {
			return pv, nil, err
		}
		amount, err := tool.ParsePositive("amount", in.Amount, unit)
		if err != nil {
			return pv, nil, err
		}
		pv.Changes = []tool.Change{{Field: "limit", After: tool.MoneyValue(amount)}, {Field: "date", After: tool.DateValue(in.EffectiveFrom.Time)}}
		return pv, func() (manageCardOut, error) {
			_, err := svc.AddCreditLimit(ctx, userID, app.CreditLimit{AccountID: a.ID, EffectiveFrom: in.EffectiveFrom.Time, Amount: amount})
			out.ID = a.ID.String()
			return out, err
		}, nil
	default:
		rule := domain.BillingCycleRule{
			EffectiveFrom: domain.MonthOf(in.EffectiveFrom.Time), ClosingMode: domain.ClosingDay, ClosingDay: in.ClosingDay, DueDay: in.DueDay,
			Assignment: domain.AssignNext, Adjustment: "following", ClosingAdjustment: "none",
		}
		pv.Changes = []tool.Change{
			{Field: "closing_day", After: tool.TextValue(strconv.Itoa(in.ClosingDay))},
			{Field: "due_day", After: tool.TextValue(strconv.Itoa(in.DueDay))},
			{Field: "date", After: tool.DateValue(rule.EffectiveFrom.FirstDay())},
		}
		return pv, func() (manageCardOut, error) {
			_, err := svc.AddBillingRule(ctx, userID, a.ID, rule)
			out.ID = a.ID.String()
			return out, err
		}, nil
	}
}
