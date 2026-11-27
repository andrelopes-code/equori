package toolapi

import (
	"context"
	"regexp"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type manageCardAction string

func (manageCardAction) Values() []string {
	return []string{
		"add_card",
		"edit_card",
		"remove_card",
		"set_card_active",
		"set_credit_limit",
		"set_billing_cycle",
	}
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
	AccountID     string           `json:"account_id"              jsonschema:"credit card account, from list_accounts"`
	Action        manageCardAction `json:"action"                  jsonschema:"operation to propose"`
	CardID        string           `json:"card_id,omitzero"        jsonschema:"for set_card_active: card from get_account_details"`
	Holder        string           `json:"holder,omitzero"         jsonschema:"for add_card: name printed on the card"`
	LastFour      string           `json:"last_four,omitzero"      jsonschema:"for add_card: last four digits"`
	Virtual       bool             `json:"virtual,omitzero"        jsonschema:"for add_card: the card is virtual"`
	Network       string           `json:"network,omitzero"        jsonschema:"for add_card and edit_card: card network key in lower case, such as visa, mastercard, elo or amex"`
	Active        bool             `json:"active,omitzero"         jsonschema:"for set_card_active: true activates, false deactivates"`
	Amount        string           `json:"amount,omitzero"         jsonschema:"for set_credit_limit: positive limit in the card's currency"`
	EffectiveFrom tool.Date        `json:"effective_from,omitzero" jsonschema:"for set_credit_limit: first day of the limit; for set_billing_cycle: a date of the first statement month; replaces its version"`
	ClosingDay    int              `json:"closing_day,omitzero"    jsonschema:"for set_billing_cycle: day of the month the statement closes"`
	DueDay        int              `json:"due_day,omitzero"        jsonschema:"for set_billing_cycle: day of the month the statement is due"`

	ClosingMode          manageCardClosingMode `json:"closing_mode,omitzero"            jsonschema:"for set_billing_cycle: day closes on closing_day, before_due closes closing_days_before_due days before the due date; day when absent"`
	ClosingDaysBeforeDue int                   `json:"closing_days_before_due,omitzero" jsonschema:"for set_billing_cycle with closing_mode before_due: 1 to 28"`
	ClosingAdjustment    manageCardAdjustment  `json:"closing_adjustment,omitzero"      jsonschema:"for set_billing_cycle: shift of the closing date on the calendar; none when absent"`
	ClosingDayAssignment manageCardAssignment  `json:"closing_day_assignment,omitzero"  jsonschema:"for set_billing_cycle: whether a purchase on the closing day goes to the next statement or the closing one; next when absent"`
	DueDateAdjustment    manageCardAdjustment  `json:"due_date_adjustment,omitzero"     jsonschema:"for set_billing_cycle: shift of the due date on the calendar; following when absent"`
	Calendar             string                `json:"calendar,omitzero"                jsonschema:"for set_billing_cycle: business-day calendar; the region calendar when absent"`
	ForeignChargeBP      tool.OptionalInt      `json:"foreign_charge_bp,omitzero"       jsonschema:"for add_card: charge on purchases in another currency, in basis points from 0 to 10000"`
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
		Description: "Proposes a change to a credit card account's setup: add a plastic or virtual card, correct the holder, last four digits or network of one, remove one, activate or deactivate one, set a new credit limit or billing cycle. " +
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

func planCard(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageCardIn,
) (tool.Preview, func() (manageCardOut, error), error) {
	pv := tool.Preview{Action: "manage_card." + string(in.Action)}

	id, err := requiredID(in.AccountID, "account_id")
	if err != nil {
		return pv, nil, err
	}

	cardID, err := optionalID(in.CardID, "card_id")
	if err != nil {
		return pv, nil, err
	}

	if err := checkCardFields(in); err != nil {
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

	out := manageCardOut{AccountID: a.ID.String(), Action: string(in.Action)}
	switch in.Action {
	case "add_card":
		return planAddCard(ctx, svc, booksID, a, in, pv, out)
	case "edit_card":
		return planEditCard(ctx, svc, booksID, a, cardID, in, pv, out)
	case "remove_card":
		return planRemoveCard(ctx, svc, booksID, a, cardID, pv, out)
	case "set_card_active":
		return planSetCardActive(ctx, svc, booksID, a, cardID, in, pv, out)
	case "set_credit_limit":
		return planSetCreditLimit(ctx, svc, booksID, a, in, pv, out)
	default:
		return planSetBillingCycle(ctx, svc, booksID, a, in, pv, out)
	}
}

func checkCardFields(in manageCardIn) error {
	required, optional := cardFieldNames(in)

	return checkFields(
		string(in.Action),
		cardFieldsGiven(in),
		append([]string{"account_id"}, required...),
		optional...)
}

func cardFieldsGiven(in manageCardIn) map[string]bool {
	return map[string]bool{
		"account_id":              true,
		"card_id":                 in.CardID != "",
		"holder":                  in.Holder != "",
		"last_four":               in.LastFour != "",
		"virtual":                 in.Virtual,
		"network":                 in.Network != "",
		"active":                  in.Active,
		"amount":                  in.Amount != "",
		"effective_from":          !in.EffectiveFrom.IsZero(),
		"closing_day":             in.ClosingDay != 0,
		"due_day":                 in.DueDay != 0,
		"closing_mode":            in.ClosingMode != "",
		"closing_days_before_due": in.ClosingDaysBeforeDue != 0,
		"closing_adjustment":      in.ClosingAdjustment != "",
		"closing_day_assignment":  in.ClosingDayAssignment != "",
		"due_date_adjustment":     in.DueDateAdjustment != "",
		"calendar":                in.Calendar != "",
		"foreign_charge_bp":       in.ForeignChargeBP.Set,
	}
}

func cardFieldNames(in manageCardIn) (required, optional []string) {
	switch in.Action {
	case "add_card":
		required, optional = []string{
			"holder",
			"last_four",
		}, []string{
			"virtual",
			"network",
			"foreign_charge_bp",
		}
	case "edit_card":
		required, optional = []string{"card_id"}, []string{"holder", "last_four", "network"}
	case "remove_card":
		required = []string{"card_id"}
	case "set_card_active":
		required, optional = []string{"card_id"}, []string{"active"}
	case "set_credit_limit":
		required = []string{"amount", "effective_from"}
	default:
		required = []string{"due_day", "effective_from"}
		optional = []string{
			"closing_mode",
			"closing_adjustment",
			"closing_day_assignment",
			"due_date_adjustment",
			"calendar",
		}

		if in.ClosingMode == "before_due" {
			required = append(required, "closing_days_before_due")
		} else {
			required = append(required, "closing_day")
		}
	}

	return required, optional
}

type cardFaceChip string

func (cardFaceChip) Values() []string { return []string{"gold", "silver"} }

type cardFaceOrientation string

func (cardFaceOrientation) Values() []string { return []string{"horizontal", "vertical"} }

type cardFaceBrand string

func (cardFaceBrand) Values() []string { return []string{"auto", "plate", "name", "none"} }

type setCardFaceIn struct {
	AccountID   string              `json:"account_id"           jsonschema:"credit card account, from list_accounts"`
	Color       string              `json:"color,omitzero"       jsonschema:"colour of the card as lower case #rrggbb, such as #820ad1"`
	Art         string              `json:"art,omitzero"         jsonschema:"pattern drawn on the card: plain, aurora, waves, orbits, band, contour, dots, carbon, brushed or holo"`
	Chip        cardFaceChip        `json:"chip,omitzero"        jsonschema:"colour of the chip"`
	Orientation cardFaceOrientation `json:"orientation,omitzero" jsonschema:"how the card is drawn"`
	Brand       cardFaceBrand       `json:"brand,omitzero"       jsonschema:"how the institution appears: auto picks, plate draws its mark, name writes its name, none hides it"`
}

type setCardFaceOut struct {
	AccountID string `json:"account_id"`
}

func setCardFace(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "set_card_face",
		Description: "Proposes how a credit card is drawn in the app: its colour, pattern, chip, orientation and the mark of the institution. " +
			"It replaces the whole face: a value left out returns to the default, and a call with only account_id clears the face. " +
			"Use it when the user asks to change the look of a card. " +
			"Do not use it for the limit, the cycle or the plastic cards: manage_card does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in setCardFaceIn) (tool.Preview, error) {
		id, err := optionalID(in.AccountID, "account_id")
		if err != nil {
			return tool.Preview{}, err
		}

		account, err := svc.Account(ctx, booksID, id)
		if err != nil {
			return tool.Preview{}, err
		}

		pv := tool.Preview{Action: "set_card_face", Target: account.Name}
		for _, v := range []string{
			in.Color, in.Art, string(in.Chip), string(in.Orientation), string(in.Brand),
		} {
			if v != "" {
				pv.Changes = append(
					pv.Changes,
					tool.Change{Field: "card", After: tool.TextValue(v)},
				)
			}
		}

		return pv, nil
	}, func(ctx context.Context, booksID int64, in setCardFaceIn) (setCardFaceOut, error) {
		id, err := optionalID(in.AccountID, "account_id")
		if err != nil {
			return setCardFaceOut{}, err
		}

		_, err = svc.SetCardFace(ctx, booksID, id, domain.CardFace{
			Color:       in.Color,
			Art:         in.Art,
			Chip:        string(in.Chip),
			Orientation: string(in.Orientation),
			Brand:       string(in.Brand),
		})

		return setCardFaceOut{AccountID: in.AccountID}, err
	})
}

// undoCard removes the card add_card added, and sets back the state set_card_active changed.
func undoCard(in manageCardIn, out manageCardOut, _ string) (string, any, bool) {
	switch in.Action {
	case "add_card":
		return "manage_card", manageCardIn{
			AccountID: in.AccountID,
			Action:    "remove_card",
			CardID:    out.ID,
		}, true
	case "set_card_active":
		return "manage_card", manageCardIn{
			AccountID: in.AccountID,
			Action:    "set_card_active",
			CardID:    in.CardID,
			Active:    !in.Active,
		}, true
	}

	return "", nil, false
}
