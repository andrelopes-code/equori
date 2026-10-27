package app

import (
	"errors"
	"regexp"
	"strings"
)

// MCPPrompt is a user message an MCP client offers its user (design 2026-10-26 X18). Its text names
// the read tools to call first and the write tools the client confirms.
type MCPPrompt struct {
	Name, Description string
	Arguments         []MCPPromptArgument
	Render            func(args map[string]string) (string, error)
}

type MCPPromptArgument struct {
	Name, Description string
	Required          bool
}

var monthPattern = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2])$`)

// MCPPrompts returns the prompts beside the guide of guide.tmpl.
func MCPPrompts() []MCPPrompt {
	return []MCPPrompt{
		{
			Name:        "monthly_review",
			Description: "Review the income, expenses and balances of one month.",
			Arguments:   []MCPPromptArgument{{Name: "month", Description: "The month, as YYYY-MM.", Required: true}},
			Render: func(args map[string]string) (string, error) {
				month := args["month"]
				if !monthPattern.MatchString(month) {
					return "", errors.New("month must be YYYY-MM")
				}
				return "Review my finances for " + month + ". Call get_category_totals for the income and expenses of the month by " +
					"category and for the month before it, get_balances for the account balances, and search_transactions for the " +
					"largest expenses of the month. Then summarize the total income, the total expenses and the result, the three " +
					"categories that grew most against the month before, and any transaction that looks unusual. Change nothing.", nil
			},
		},
		{
			Name:        "categorize_pending",
			Description: "Categorize the transactions that have no category.",
			Render: func(map[string]string) (string, error) {
				return "Categorize my transactions that have no category. Call search_transactions for them, list_accounts for the " +
					"categories and list_rules for the rules that exist. List a category for each transaction and wait for my " +
					"approval; then call categorize_transactions with the ones I approve. For a payee that repeats, offer a rule " +
					"through manage_rule and create it only after I approve it.", nil
			},
		},
		{
			Name:        "reconcile_account",
			Description: "Reconcile one account against its statement.",
			Arguments:   []MCPPromptArgument{{Name: "account", Description: "The account's name.", Required: true}},
			Render: func(args map[string]string) (string, error) {
				account := strings.TrimSpace(args["account"])
				if account == "" {
					return "", errors.New("account is required")
				}
				return "Reconcile my account " + account + " against its statement. Call list_accounts to find it, " +
					"get_account_details and get_account_history for its balance and recent movements, and search_transactions " +
					"for the transactions not yet reconciled. Ask me for the closing balance and date of the statement, show the " +
					"difference, and call reconcile_account only after I confirm.", nil
			},
		},
	}
}
