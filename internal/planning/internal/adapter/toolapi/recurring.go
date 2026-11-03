package toolapi

import (
	"context"
	"encoding/json"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/textfold"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

const (
	maxRecurringSeries = 20
	maxRecurringText   = 100
)

type findRecurringIn struct {
	PayeeID   string `json:"payee_id,omitzero" jsonschema:"keep the series of this payee"`
	AccountID string `json:"account_id,omitzero" jsonschema:"keep the series of this account"`
	Text      string `json:"text,omitzero" jsonschema:"keep series whose payee name or description contains this text; at most 100 characters"`
}

type seriesView struct {
	Key            string     `json:"key"`
	PayeeID        string     `json:"payee_id,omitzero"`
	Payee          string     `json:"payee,omitzero"`
	AccountID      string     `json:"account_id"`
	Account        string     `json:"account"`
	CategoryID     string     `json:"category_id,omitzero"`
	Category       string     `json:"category,omitzero"`
	Frequency      string     `json:"frequency"`
	Count          int        `json:"count"`
	LastDate       tool.Date  `json:"last_date"`
	LastAmount     tool.Money `json:"last_amount"`
	NextDate       tool.Date  `json:"next_date"`
	TransactionIDs []string   `json:"transaction_ids"`
	ScheduleID     string     `json:"schedule_id"`
}

type findRecurringOut struct {
	Series []seriesView `json:"series"`
}

func findRecurring(svc *app.Service, l Ledger) tool.Tool {
	return tool.New(tool.Spec{
		Name: "find_recurring",
		Description: "Finds expenses that repeat on one account: the same payee or description at a weekly, monthly, quarterly or yearly interval, with the amount varying at most 25 percent. " +
			"Use it to answer which subscriptions or recurring bills the user has, and before proposing a subscription schedule. " +
			"Do not use it to list schedules the user created; use list_schedules. " +
			"schedule_id names the schedule that already covers a series.",
		Effect: tool.ReadOnly, Idempotent: true,
	}, func(ctx context.Context, booksID int64, in findRecurringIn) (findRecurringOut, error) {
		payeeID, err := optionalID(in.PayeeID, "payee_id")
		if err != nil {
			return findRecurringOut{}, err
		}

		accountID, err := optionalID(in.AccountID, "account_id")
		if err != nil {
			return findRecurringOut{}, err
		}

		if utf8.RuneCountInString(in.Text) > maxRecurringText {
			return findRecurringOut{}, tool.InvalidArgument("text", "is longer than 100 characters")
		}

		series, err := svc.Recurring(ctx, booksID, app.RecurringFilter{PayeeID: payeeID, AccountID: accountID})
		if err != nil {
			return findRecurringOut{}, err
		}

		accounts, err := l.Accounts(ctx, booksID)
		if err != nil {
			return findRecurringOut{}, err
		}

		payees, err := l.PayeeNames(ctx, booksID)
		if err != nil {
			return findRecurringOut{}, err
		}

		text := textfold.String(in.Text)
		out := findRecurringOut{Series: []seriesView{}}

		for _, s := range series {
			if len(out.Series) == maxRecurringSeries {
				break
			}

			name := payees[s.PayeeID]
			if !strings.Contains(textfold.String(name), text) && !strings.Contains(textfold.String(s.Key), text) {
				continue
			}

			v, err := toSeriesView(s, name, accounts)
			if err != nil {
				return findRecurringOut{}, err
			}

			out.Series = append(out.Series, v)
		}

		return out, nil
	})
}

func toSeriesView(s app.Series, payee string, accounts map[uuid.UUID]Account) (seriesView, error) {
	amount, err := moneyOf(s.LastAmount, accounts[s.AccountID].Instrument)
	if err != nil {
		return seriesView{}, err
	}

	v := seriesView{
		Key: s.Key, Payee: payee, AccountID: s.AccountID.String(), Account: accountName(accounts, s.AccountID),
		Category: accountName(accounts, s.CategoryID), Frequency: s.Frequency, Count: s.Count,
		LastDate: tool.DateOf(s.LastDate), LastAmount: amount, NextDate: tool.DateOf(s.NextDate),
		TransactionIDs: []string{},
	}
	if s.PayeeID != uuid.Nil {
		v.PayeeID = s.PayeeID.String()
	}

	if s.CategoryID != uuid.Nil {
		v.CategoryID = s.CategoryID.String()
	}

	if s.ScheduleID != uuid.Nil {
		v.ScheduleID = s.ScheduleID.String()
	}

	for _, id := range s.TransactionIDs {
		v.TransactionIDs = append(v.TransactionIDs, id.String())
	}

	return v, nil
}

// EncodeSeries encodes s as find_recurring encodes one element of its series.
func EncodeSeries(s app.Series, payee string, accounts map[uuid.UUID]Account) (json.RawMessage, error) {
	v, err := toSeriesView(s, payee, accounts)
	if err != nil {
		return nil, err
	}

	return json.Marshal(v)
}
