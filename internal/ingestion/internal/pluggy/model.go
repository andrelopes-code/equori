// Package pluggy reads Pluggy items, accounts, bills and transactions and translates them
// into Ingestion's records (anti-corruption layer, chapter 4).
package pluggy

import (
	"bytes"
	"errors"
)

// Decimal keeps the text of a JSON number, so amounts never pass through binary floating point (P6 A37).
type Decimal string

func (d *Decimal) UnmarshalJSON(b []byte) error {
	if bytes.Equal(b, []byte("null")) {
		*d = ""
		return nil
	}
	if len(b) == 0 || b[0] == '"' {
		return errors.New("amount is not a JSON number")
	}
	*d = Decimal(b)
	return nil
}

func (d Decimal) MarshalJSON() ([]byte, error) {
	if d == "" {
		return []byte("null"), nil
	}
	return []byte(d), nil
}

type Item struct {
	ID              string  `json:"id"`
	Status          string  `json:"status"`
	ExecutionStatus string  `json:"executionStatus"`
	LastUpdatedAt   *string `json:"lastUpdatedAt"`
	NextAutoSyncAt  *string `json:"nextAutoSyncAt"`
	Connector       struct {
		Name string `json:"name"`
	} `json:"connector"`
}

type Account struct {
	ID           string      `json:"id"`
	Type         string      `json:"type"`
	Subtype      string      `json:"subtype"`
	Name         string      `json:"name"`
	Number       string      `json:"number"`
	Balance      Decimal     `json:"balance"`
	CurrencyCode string      `json:"currencyCode"`
	CreditData   *CreditData `json:"creditData"`
	BankData     *BankData   `json:"bankData"`
}

// BankData holds what Pluggy reports only for bank accounts.
type BankData struct {
	ReservedBalances []ReservedBalance `json:"reservedBalances"`
}

// ReservedBalance is money set aside inside a bank account and outside its balance, such as a
// Mercado Pago "cofrinho" (A73).
type ReservedBalance struct {
	Name             string           `json:"name"`
	Identification   string           `json:"identification"`
	AvailableAmounts []ReservedAmount `json:"availableAmounts"`
}

type ReservedAmount struct {
	Amount       Decimal `json:"amount"`
	CurrencyCode string  `json:"currencyCode"`
}

type CreditData struct {
	BalanceCloseDate string `json:"balanceCloseDate"`
	BalanceDueDate   string `json:"balanceDueDate"`
}

type Transaction struct {
	ID                      string        `json:"id"`
	Description             string        `json:"description"`
	DescriptionRaw          *string       `json:"descriptionRaw"`
	CurrencyCode            string        `json:"currencyCode"`
	Amount                  Decimal       `json:"amount"`
	AmountInAccountCurrency Decimal       `json:"amountInAccountCurrency"`
	Date                    string        `json:"date"`
	Balance                 Decimal       `json:"balance"`
	Category                *string       `json:"category"`
	CategoryID              *string       `json:"categoryId"`
	Type                    string        `json:"type"`
	Status                  string        `json:"status"`
	OperationType           *string       `json:"operationType"`
	CreditCardMetadata      *CardMetadata `json:"creditCardMetadata"`
}

type CardMetadata struct {
	InstallmentNumber int     `json:"installmentNumber"`
	TotalInstallments int     `json:"totalInstallments"`
	TotalAmount       Decimal `json:"totalAmount"`
	PurchaseDate      *string `json:"purchaseDate"`
	BillID            *string `json:"billId"`
}

type Bill struct {
	ID                   string  `json:"id"`
	DueDate              string  `json:"dueDate"`
	BillClosingDate      *string `json:"billClosingDate"`
	TotalAmount          Decimal `json:"totalAmount"`
	MinimumPaymentAmount Decimal `json:"minimumPaymentAmount"`
}

// Item statuses that allow a sync (P6 A43).
const (
	StatusUpdated  = "UPDATED"
	StatusUpdating = "UPDATING"
)

// Account kinds.
const (
	TypeCredit       = "CREDIT"
	SubtypeChecking  = "CHECKING_ACCOUNT"
	SubtypeSavings   = "SAVINGS_ACCOUNT"
	SubtypeCard      = "CREDIT_CARD"
	SubtypeReserve   = "RESERVED_BALANCE"
	statusPending    = "PENDING"
	recordDateLayout = "2006-01-02"
)
