package apitest

import (
	"fmt"
	"net/http"
	"strings"
)

// Account creates an account in the profile's base currency and returns its id.
func (h *Harness) Account(name, class, kind string, extra map[string]any) string {
	h.t.Helper()

	body := map[string]any{"name": name, "class": class, "currency": string(h.Profile.Base)}
	if kind != "" {
		body["kind"] = kind
	}

	for k, v := range extra {
		body[k] = v
	}

	var out struct {
		ID string `json:"id"`
	}
	h.MustDo(http.MethodPost, "/api/v1/accounts", body, http.StatusCreated, &out)

	return out.ID
}

// Record posts a transaction and returns its id.
func (h *Harness) Record(date string, postings ...map[string]any) string {
	h.t.Helper()
	var out struct {
		ID string `json:"id"`
	}
	h.MustDo(
		http.MethodPost,
		"/api/v1/transactions",
		map[string]any{"date": date, "description": "test", "postings": postings},
		http.StatusCreated,
		&out,
	)

	return out.ID
}

func BRL(amount int64) map[string]any { return map[string]any{"amount": amount, "currency": "BRL"} }

func Posting(account string, amount int64) map[string]any {
	return map[string]any{"account_id": account, "amount": BRL(amount)}
}

// Money is an amount in the base currency of the harness profile.
func (h *Harness) Money(amount int64) map[string]any {
	return map[string]any{"amount": amount, "currency": string(h.Profile.Base)}
}

// Posting is apitest.Posting in the base currency of the harness profile.
func (h *Harness) Posting(account string, amount int64) map[string]any {
	return map[string]any{"account_id": account, "amount": h.Money(amount)}
}

// Card creates a credit card account with a billing cycle rule from 2026-01.
func (h *Harness) Card(name string, closingDay, dueDay int, assignment string) string {
	h.t.Helper()
	id := h.Account(name, "liability", "credit_card", nil)
	h.MustDo(http.MethodPost, "/api/v1/accounts/"+id+"/billing-cycle-rules", map[string]any{
		"effective_from":         "2026-01",
		"closing_day":            closingDay,
		"due_day":                dueDay,
		"closing_day_assignment": assignment,
	}, http.StatusCreated, nil)

	return id
}

// Transaction returns the decoded transaction.
func (h *Harness) Transaction(id string) TransactionView {
	h.t.Helper()
	var out TransactionView
	h.MustDo(http.MethodGet, "/api/v1/transactions/"+id, nil, http.StatusOK, &out)

	return out
}

type TransactionView struct {
	ID          string        `json:"id"`
	Version     int           `json:"version"`
	Date        string        `json:"date"`
	Description string        `json:"description"`
	Origin      string        `json:"origin"`
	Postings    []PostingView `json:"postings"`
}

type PostingView struct {
	ID        string `json:"id"`
	AccountID string `json:"account_id"`
	Amount    struct {
		Amount int64 `json:"amount"`
	} `json:"amount"`
	Statement   string `json:"statement"`
	Status      string `json:"status"`
	CardRole    string `json:"card_role"`
	Installment *struct {
		Number int    `json:"number"`
		Count  int    `json:"count"`
		PlanID string `json:"plan_id"`
	} `json:"installment"`
}

// Rows runs a query and returns one string per row, the columns joined by a space.
func (h *Harness) Rows(sql string, args ...any) []string {
	h.t.Helper()

	rows, err := h.Pool.Query(h.t.Context(), sql, args...)
	if err != nil {
		h.t.Fatalf("query: %v", err)
	}
	defer rows.Close()

	var out []string

	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			h.t.Fatalf("scan: %v", err)
		}

		parts := make([]string, len(values))
		for i, v := range values {
			parts[i] = fmt.Sprint(v)
		}

		out = append(out, strings.Join(parts, " "))
	}

	if err := rows.Err(); err != nil {
		h.t.Fatalf("rows: %v", err)
	}

	return out
}
