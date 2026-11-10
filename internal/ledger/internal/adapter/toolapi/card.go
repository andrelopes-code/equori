package toolapi

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/app"
	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type manageCardAction string

func (manageCardAction) Values() []string {
	return []string{"add_card", "edit_card", "remove_card", "set_card_active", "set_credit_limit", "set_billing_cycle"}
}

type manageCardClosingMode string

func (manageCardClosingMode) Values() []string { return []string{"day", "before_due"} }

type manageCardAdjustment string

func (manageCardAdjustment) Values() []string {
	return []string{"none", "following", "preceding", "modified_following"}
}

type manageCardAssignment string

func (manageCardAssignment) Values() []string { return []string{"next", "closing"} }

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

	ClosingMode          manageCardClosingMode `json:"closing_mode,omitzero" jsonschema:"for set_billing_cycle: day closes on closing_day, before_due closes closing_days_before_due days before the due date; day when absent"`
	ClosingDaysBeforeDue int                   `json:"closing_days_before_due,omitzero" jsonschema:"for set_billing_cycle with closing_mode before_due: 1 to 28"`
	ClosingAdjustment    manageCardAdjustment  `json:"closing_adjustment,omitzero" jsonschema:"for set_billing_cycle: shift of the closing date on the calendar; none when absent"`
	ClosingDayAssignment manageCardAssignment  `json:"closing_day_assignment,omitzero" jsonschema:"for set_billing_cycle: whether a purchase on the closing day goes to the next statement or the closing one; next when absent"`
	DueDateAdjustment    manageCardAdjustment  `json:"due_date_adjustment,omitzero" jsonschema:"for set_billing_cycle: shift of the due date on the calendar; following when absent"`
	Calendar             string                `json:"calendar,omitzero" jsonschema:"for set_billing_cycle: business-day calendar; the region calendar when absent"`
	ForeignChargeBP      tool.OptionalInt      `json:"foreign_charge_bp,omitzero" jsonschema:"for add_card: charge on purchases in another currency, in basis points from 0 to 10000"`
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
		Description: "Proposes a change to a credit card account's setup: add a plastic or virtual card, correct the holder or last four digits of one, remove one, activate or deactivate one, set a new credit limit or a new billing cycle. " +
			"Use it when the user changes card details. " +
			"Do not use it for purchases or statements: handle_card_purchase and settle_statement do. " +
			"The user confirms every change.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in manageCardIn) (tool.Preview, error) {
		pv, _, err := planCard(ctx, svc, booksID, in)
		return pv, err
	}, func(ctx context.Context, booksID int64, in manageCardIn) (manageCardOut, error) {
		_, run, err := planCard(ctx, svc, booksID, in)
		if err != nil {
			return manageCardOut{}, err
		}

		return run()
	})
}

func cardText(c domain.Card) string { return c.Holder + " " + c.LastFour }

func planCard(ctx context.Context, svc *app.Service, booksID int64, in manageCardIn) (tool.Preview, func() (manageCardOut, error), error) {
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
		"closing_mode": in.ClosingMode != "", "closing_days_before_due": in.ClosingDaysBeforeDue != 0,
		"closing_adjustment": in.ClosingAdjustment != "", "closing_day_assignment": in.ClosingDayAssignment != "",
		"due_date_adjustment": in.DueDateAdjustment != "", "calendar": in.Calendar != "", "foreign_charge_bp": in.ForeignChargeBP.Set,
	}

	var required, optional []string
	switch in.Action {
	case "add_card":
		required, optional = []string{"holder", "last_four"}, []string{"virtual", "foreign_charge_bp"}
	case "edit_card":
		required, optional = []string{"card_id"}, []string{"holder", "last_four"}
	case "remove_card":
		required = []string{"card_id"}
	case "set_card_active":
		required, optional = []string{"card_id"}, []string{"active"}
	case "set_credit_limit":
		required = []string{"amount", "effective_from"}
	default:
		required = []string{"due_day", "effective_from"}
		optional = []string{"closing_mode", "closing_adjustment", "closing_day_assignment", "due_date_adjustment", "calendar"}

		if in.ClosingMode == "before_due" {
			required = append(required, "closing_days_before_due")
		} else {
			required = append(required, "closing_day")
		}
	}

	if err := checkFields(action, given, append([]string{"account_id"}, required...), optional...); err != nil {
		return pv, nil, err
	}

	a, err := svc.Account(ctx, booksID, id)
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
		if in.ForeignChargeBP.Set {
			pv.Changes = append(pv.Changes, tool.Change{Field: "rate", After: tool.TextValue(fmt.Sprintf("%d bp on foreign purchases", in.ForeignChargeBP.N))})
		}

		return pv, func() (manageCardOut, error) {
			created, err := svc.AddCard(ctx, booksID, c, optionalBP(in.ForeignChargeBP))
			out.ID = created.ID.String()

			return out, err
		}, nil
	case "edit_card":
		return planEditCard(ctx, svc, booksID, a, cardID, in, pv, out)
	case "remove_card":
		c, err := cardOf(ctx, svc, booksID, a.ID, cardID)
		if err != nil {
			return pv, nil, err
		}

		pv.Changes = []tool.Change{{Field: "card", Before: tool.TextValue(cardText(c))}}
		pv.Destructive = true

		return pv, func() (manageCardOut, error) {
			out.ID = c.ID.String()

			return out, svc.DeleteCard(ctx, booksID, c.ID)
		}, nil
	case "set_card_active":
		c, err := cardOf(ctx, svc, booksID, a.ID, cardID)
		if err != nil {
			return pv, nil, err
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
			_, err := svc.EditCard(ctx, booksID, c.ID, domain.CardEdit{Active: &in.Active})
			out.ID = c.ID.String()

			return out, err
		}, nil
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
			_, err := svc.AddCreditLimit(ctx, booksID, app.CreditLimit{AccountID: a.ID, EffectiveFrom: in.EffectiveFrom.Time, Amount: amount})
			out.ID = a.ID.String()

			return out, err
		}, nil
	default:
		rule := domain.BillingCycleRule{
			EffectiveFrom: domain.MonthOf(in.EffectiveFrom.Time), ClosingMode: string(in.ClosingMode), ClosingDay: in.ClosingDay,
			ClosingDaysBeforeDue: in.ClosingDaysBeforeDue, DueDay: in.DueDay, Assignment: string(in.ClosingDayAssignment),
			Adjustment: string(in.DueDateAdjustment), ClosingAdjustment: string(in.ClosingAdjustment), Calendar: in.Calendar,
		}
		pv.Changes = cycleChanges(in, rule)

		return pv, func() (manageCardOut, error) {
			_, err := svc.AddBillingRule(ctx, booksID, a.ID, rule)
			out.ID = a.ID.String()

			return out, err
		}, nil
	}
}

func planEditCard(ctx context.Context, svc *app.Service, booksID int64, a domain.Account, cardID uuid.UUID, in manageCardIn, pv tool.Preview, out manageCardOut) (tool.Preview, func() (manageCardOut, error), error) {
	if in.Holder == "" && in.LastFour == "" {
		return pv, nil, tool.InvalidArgument("holder", "give the holder, the last_four or both")
	}

	c, err := cardOf(ctx, svc, booksID, a.ID, cardID)
	if err != nil {
		return pv, nil, err
	}

	edit := domain.CardEdit{}
	if in.Holder != "" {
		edit.Holder = &in.Holder
	}

	if in.LastFour != "" {
		if !lastFourPattern.MatchString(in.LastFour) {
			return pv, nil, tool.InvalidArgument("last_four", "must be four digits")
		}

		edit.LastFour = &in.LastFour
	}

	after := c
	if edit.Holder != nil {
		after.Holder = *edit.Holder
	}

	if edit.LastFour != nil {
		after.LastFour = *edit.LastFour
	}

	pv.Changes = []tool.Change{{Field: "card", Before: tool.TextValue(cardText(c)), After: tool.TextValue(cardText(after))}}

	return pv, func() (manageCardOut, error) {
		_, err := svc.EditCard(ctx, booksID, c.ID, edit)
		out.ID = c.ID.String()

		return out, err
	}, nil
}

// cardOf returns the card of the account, or app.ErrNotFound.
func cardOf(ctx context.Context, svc *app.Service, booksID int64, accountID, cardID uuid.UUID) (domain.Card, error) {
	cards, err := svc.Cards(ctx, booksID, accountID)
	if err != nil {
		return domain.Card{}, err
	}

	for _, c := range cards {
		if c.ID == cardID {
			return c, nil
		}
	}

	return domain.Card{}, app.ErrNotFound
}

func optionalBP(o tool.OptionalInt) *int {
	if !o.Set {
		return nil
	}

	return &o.N
}

// cycleChanges lists what a set_billing_cycle call sets. The options the call left out take the
// defaults of the domain, so only the ones it gave are listed.
func cycleChanges(in manageCardIn, rule domain.BillingCycleRule) []tool.Change {
	closing := strconv.Itoa(in.ClosingDay)
	if in.ClosingMode == "before_due" {
		closing = fmt.Sprintf("%d days before the due date", in.ClosingDaysBeforeDue)
	}

	changes := []tool.Change{
		{Field: "closing_day", After: tool.TextValue(closing)},
		{Field: "due_day", After: tool.TextValue(strconv.Itoa(in.DueDay))},
		{Field: "date", After: tool.DateValue(rule.EffectiveFrom.FirstDay())},
	}

	var options []string

	for _, o := range []struct{ name, value string }{
		{"closing adjustment", rule.ClosingAdjustment}, {"closing day assignment", rule.Assignment},
		{"due date adjustment", rule.Adjustment}, {"calendar", rule.Calendar},
	} {
		if o.value != "" {
			options = append(options, o.name+" "+o.value)
		}
	}

	if len(options) > 0 {
		changes = append(changes, tool.Change{Field: "terms", After: tool.TextValue(strings.Join(options, ", "))})
	}

	return changes
}
