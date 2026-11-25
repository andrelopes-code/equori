package toolapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type movementView struct {
	MovementID    string     `json:"movement_id"`
	Kind          string     `json:"kind"                    jsonschema:"what the bank reports: buy, sell, income, tax, amortization or transfer"`
	Date          tool.Date  `json:"date"`
	Amount        tool.Money `json:"amount"`
	State         string     `json:"state"                   jsonschema:"pending, confirmed or dismissed"`
	Proposal      string     `json:"proposal"                jsonschema:"what a confirmation records: application (first purchase, creates the contract), contribution, sale, income, tax_of_sale (recorded with its sale) or none (nothing to record)"`
	Taxes         tool.Money `json:"taxes,omitzero"          jsonschema:"taxes the bank attached to this sale"`
	TransactionID string     `json:"transaction_id,omitzero" jsonschema:"transaction a confirmation recorded"`
}

type investmentView struct {
	InvestmentID string         `json:"investment_id"`
	Name         string         `json:"name"`
	Type         string         `json:"type"`
	Subtype      string         `json:"subtype,omitzero"`
	Issuer       string         `json:"issuer,omitzero"`
	MaturesOn    tool.Date      `json:"matures_on,omitzero"`
	HasTerms     bool           `json:"has_terms"             jsonschema:"false when the bank reports no rate: the contract is created without terms and manage_instrument set_terms adds them"`
	Balance      tool.Money     `json:"balance"`
	BalanceDate  tool.Date      `json:"balance_date"`
	Instrument   string         `json:"instrument,omitzero"   jsonschema:"code of the contract in the book, once the application is confirmed"`
	BrokerageID  string         `json:"brokerage_id,omitzero" jsonschema:"Brokerage that holds it, once the application is confirmed"`
	Movements    []movementView `json:"movements"`
}

type reviewAction string

func (reviewAction) Values() []string { return []string{"confirm", "dismiss", "undo"} }

type reviewInvestmentMovementIn struct {
	Action        reviewAction `json:"action"                   jsonschema:"what to do with the movement"`
	MovementID    string       `json:"movement_id"              jsonschema:"movement from get_imports with view investments"`
	BrokerageID   string       `json:"brokerage_id,omitzero"    jsonschema:"for confirm of an application: Brokerage that will hold the contract, from list_accounts"`
	CashAccountID string       `json:"cash_account_id,omitzero" jsonschema:"for confirm: Cash of the Brokerage or an open account of its institution; the single candidate when absent"`
	CategoryID    string       `json:"category_id,omitzero"     jsonschema:"for confirm of an income: income category, from list_accounts"`
	Withheld      string       `json:"withheld,omitzero"        jsonschema:"for confirm of an income: tax withheld; 0 when absent"`
}

func reviewInvestmentMovement(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "review_investment_movement",
		Description: "Proposes the review of one movement of an investment that a bank connection reports: confirm records what it proposes in the ledger, dismiss records nothing, undo voids what a confirmation recorded or reopens a dismissed movement. " +
			"The application of an investment is confirmed before its other movements (investment_not_applied), and a confirmation is undone from the latest movement back (later_movement_confirmed). " +
			"Use it when the user asks to accept, ignore or revert investment movements read from a bank. " +
			"Do not use it for the lines of a bank account: manage_imports with resolve_record does. " +
			"The user confirms first.",
		Effect: tool.Destructive,
	}, func(ctx context.Context, booksID int64, in reviewInvestmentMovementIn) (tool.Preview, error) {
		pv, _, err := planMovementReview(ctx, svc, booksID, in)
		return pv, err
	}, func(ctx context.Context, booksID int64, in reviewInvestmentMovementIn) (movementView, error) {
		_, run, err := planMovementReview(ctx, svc, booksID, in)
		if err != nil {
			return movementView{}, err
		}

		v, err := run()
		if err != nil {
			return movementView{}, err
		}

		return toMovementView(v.Movement, v.Proposal)
	})
}

func planMovementReview(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in reviewInvestmentMovementIn,
) (tool.Preview, func() (app.MovementView, error), error) {
	pv := tool.Preview{Action: "review_investment_movement." + string(in.Action)}

	ids, err := movementReviewIDs(in)
	if err != nil {
		return pv, nil, err
	}

	inv, v, err := svc.Movement(ctx, booksID, ids[0])
	if err != nil {
		return pv, nil, err
	}

	pv.Target = inv.Source.Name
	pv.Changes = []tool.Change{
		{Field: "amount", After: tool.MoneyValue(v.Movement.Amount)},
		{Field: "kind", After: tool.TextValue(v.Proposal.Kind)},
		{Field: "date", After: tool.DateValue(v.Movement.Date)},
	}

	withheld, err := movementWithheld(in, v)
	if err != nil {
		return pv, nil, err
	}

	if withheld != nil {
		pv.Changes = append(
			pv.Changes,
			tool.Change{Field: "withheld", After: tool.MoneyValue(*withheld)},
		)
	}

	return pv, func() (app.MovementView, error) {
		switch in.Action {
		case "dismiss":
			return svc.DismissMovement(ctx, booksID, ids[0])
		case "undo":
			return svc.UndoMovement(ctx, booksID, ids[0])
		}

		return svc.ConfirmMovement(ctx, booksID, ids[0], app.Confirmation{
			BrokerageID:   ids[1],
			CashAccountID: ids[2],
			CategoryID:    ids[3],
			Withheld:      withheld,
		})
	}, nil
}

// movementWithheld returns the tax in names, 0 for an income without one, nil for any other
// movement without one.
func movementWithheld(in reviewInvestmentMovementIn, v app.MovementView) (*money.Money, error) {
	if in.Action != "confirm" {
		return nil, nil
	}

	text := in.Withheld
	if text == "" {
		if v.Proposal.Kind != domain.ProposalIncome {
			return nil, nil
		}

		text = "0"
	}

	withheld, err := tool.ParseAmount("withheld", text, v.Movement.Amount)

	return &withheld, err
}

// movementReviewIDs returns the movement, the brokerage, the cash and the category of in.
func movementReviewIDs(in reviewInvestmentMovementIn) ([4]uuid.UUID, error) {
	var ids [4]uuid.UUID

	fields := []field{
		{"movement_id", in.MovementID != ""},
		{"brokerage_id", in.BrokerageID != ""},
		{"cash_account_id", in.CashAccountID != ""},
		{"category_id", in.CategoryID != ""},
		{"withheld", in.Withheld != ""},
	}

	if in.Action != "confirm" {
		if err := required(string(in.Action), fields, "movement_id"); err != nil {
			return ids, err
		}
	}

	for i, text := range []string{in.MovementID, in.BrokerageID, in.CashAccountID, in.CategoryID} {
		id, err := optionalID(text, fields[i].name)
		if err != nil {
			return ids, err
		}

		ids[i] = id
	}

	return ids, nil
}

func investments(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in getImportsIn,
	fields []field,
) (getImportsOut, error) {
	if err := required("investments", fields, "connection_id"); err != nil {
		return getImportsOut{}, err
	}

	connection, err := optionalID(in.ConnectionID, "connection_id")
	if err != nil {
		return getImportsOut{}, err
	}

	found, err := svc.Investments(ctx, booksID, connection)
	if err != nil {
		return getImportsOut{}, err
	}

	out := getImportsOut{Investments: make([]investmentView, len(found))}
	for i, v := range found {
		if out.Investments[i], err = toInvestmentView(v); err != nil {
			return getImportsOut{}, err
		}
	}

	return out, nil
}

func toInvestmentView(v app.InvestmentView) (investmentView, error) {
	src := v.Source

	out := investmentView{
		InvestmentID: v.ID.String(),
		Name:         src.Name,
		Type:         src.Type,
		Subtype:      src.Subtype,
		Issuer:       src.Issuer,
		HasTerms:     src.HasTerms,
		Balance:      tool.MoneyOf(src.Balance),
		BalanceDate:  tool.DateOf(src.BalanceDate),
		Movements:    make([]movementView, len(v.Movements)),
	}
	if src.MaturesOn != nil {
		out.MaturesOn = tool.DateOf(*src.MaturesOn)
	}

	if v.Instrument != nil {
		out.Instrument = *v.Instrument
	}

	if v.BrokerageID != nil {
		out.BrokerageID = v.BrokerageID.String()
	}

	for i, m := range v.Movements {
		var err error
		if out.Movements[i], err = toMovementView(m, v.Proposals[i]); err != nil {
			return investmentView{}, err
		}
	}

	return out, nil
}

func toMovementView(m domain.StoredMovement, p domain.Proposal) (movementView, error) {
	out := movementView{
		MovementID: m.ID.String(),
		Kind:       m.Kind,
		Date:       tool.DateOf(m.Date),
		Amount:     tool.MoneyOf(m.Amount),
		State:      m.State,
		Proposal:   p.Kind,
	}
	if m.TransactionID != nil {
		out.TransactionID = m.TransactionID.String()
	}

	if p.Taxes == 0 {
		return out, nil
	}

	taxes, err := moneyOf(p.Taxes, string(m.Amount.Currency()))
	out.Taxes = taxes

	return out, err
}
