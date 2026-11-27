package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// createFixedIncomeApplication answers 201 with the new purchase and 200 when the application
// already ran. It does not use HandleCreated, which always answers 201.
func (s *Server) createFixedIncomeApplication(w http.ResponseWriter, r *http.Request) {
	var in CreateFixedIncomeApplicationJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		s.errs.WriteRequestError(w, r, fmt.Errorf("can't decode JSON body: %w", err))

		return
	}

	a, err := fixedIncomeFromInput(in)
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	res, err := s.svc.ApplyFixedIncome(r.Context(), auth.MustBooksID(r.Context()), a)
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(toFixedIncomeAPI(res)); err != nil {
		s.errs.Write(w, r, err)

		return
	}

	w.Header().Set("Content-Type", "application/json")

	status := http.StatusCreated
	if res.Replayed {
		status = http.StatusOK
	} else {
		w.Header().Set("Location", location("/transactions/", res.TransactionID))
	}

	w.WriteHeader(status)
	_, _ = buf.WriteTo(w)
}

func fixedIncomeFromInput(in CreateFixedIncomeApplicationJSONRequestBody) (
	app.FixedIncomeApplication, error,
) {
	amount, err := fromMoneyAPI("amount", in.Amount)
	if err != nil {
		return app.FixedIncomeApplication{}, err
	}

	a := app.FixedIncomeApplication{
		ApplicationID: in.ApplicationId,
		BrokerageID:   in.BrokerageId,
		CashAccountID: optUUID(in.CashAccountId),
		AppliedOn:     dateOf(in.AppliedOn),
		Amount:        amount,
		Description:   optString(in.Description),
		Instrument:    money.Currency(optString(in.Instrument)),
		Opening:       in.Opening != nil && *in.Opening,
	}

	if in.Fees != nil {
		fees, err := fromMoneyAPI("fees", *in.Fees)
		if err != nil {
			return app.FixedIncomeApplication{}, err
		}

		a.Fees = &fees
	}

	if in.Contract != nil {
		c := contractFromInput(*in.Contract)
		a.Contract = &c
	}

	return a, nil
}

func contractFromInput(in FixedIncomeContractInput) app.Contract {
	c := app.Contract{
		Subtype:        in.Subtype,
		IssuerName:     in.Issuer,
		IssuerScheme:   optString(in.IssuerScheme),
		IssuerID:       optString(in.IssuerId),
		Name:           optString(in.Name),
		MaturesOn:      dateOf(in.MaturesOn),
		IndexID:        optString(in.IndexId),
		CalendarID:     optString(in.CalendarId),
		DailyLiquidity: in.DailyLiquidity != nil && *in.DailyLiquidity,
	}

	if in.DayCount != nil {
		c.DayCount = string(*in.DayCount)
	}

	if in.PercentOfIndexBp != nil {
		c.PercentOfIndexBP = *in.PercentOfIndexBp
	}

	if in.SpreadBp != nil {
		c.SpreadBP = *in.SpreadBp
	}

	if d := optDate(in.IssuedOn); d != nil {
		c.IssuedOn = *d
	}

	if d := optDate(in.RedeemableFrom); d != nil {
		c.RedeemableFrom = *d
	}

	if in.InterestEveryMonths != nil {
		c.InterestEveryMonths = int(*in.InterestEveryMonths)
	}

	if d := optDate(in.FirstPaymentOn); d != nil {
		c.FirstPaymentOn = *d
	}

	if in.Payments != nil {
		c.Payments = paymentsFromInput(*in.Payments)
	}

	return c
}

func paymentsFromInput(in []FixedIncomeContractPayment) []app.Payment {
	out := make([]app.Payment, 0, len(in))

	for _, p := range in {
		out = append(out, app.Payment{
			PaysOn:         dateOf(p.PaysOn),
			AmortizationBP: p.AmortizationBp,
			PaysInterest:   p.PaysInterest,
		})
	}

	return out
}

func toFixedIncomeAPI(r app.FixedIncomeResult) FixedIncomeApplication {
	return FixedIncomeApplication{
		Instrument:    string(r.Instrument),
		TransactionId: r.TransactionID,
		Quantity:      toMoneyAPI(r.Quantity),
		UnitPrice:     r.UnitPrice.String(),
	}
}
