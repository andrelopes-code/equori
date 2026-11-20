// Package viewapi builds the views of the ledger's reads from their tool outputs (answer views design, V4).
package viewapi

import "github.com/andrelopes-code/equori/internal/platform/tool"

// The JSON of the tool outputs the views read; the shapes are those of internal/ledger/toolapi.

type postingView struct {
	AccountName  string     `json:"account_name"`
	AccountClass string     `json:"account_class"`
	Amount       tool.Money `json:"amount"`
}

type transactionView struct {
	ID          string        `json:"id"`
	Date        tool.Date     `json:"date"`
	Description string        `json:"description"`
	PayeeName   string        `json:"payee_name"`
	Voided      bool          `json:"voided"`
	Tags        []string      `json:"tags"`
	Postings    []postingView `json:"postings"`
}

type searchTransactionsOut struct {
	Transactions []transactionView `json:"transactions"`
	NextCursor   string            `json:"next_cursor"`
}

type historyEntry struct {
	Version    int    `json:"version"`
	Reason     string `json:"reason"`
	ReplacedAt string `json:"replaced_at"`
}

type attachmentView struct {
	FileName string `json:"file_name"`
	Size     int64  `json:"size"`
}

type getTransactionOut struct {
	Transaction transactionView  `json:"transaction"`
	History     []historyEntry   `json:"history"`
	Attachments []attachmentView `json:"attachments"`
}
