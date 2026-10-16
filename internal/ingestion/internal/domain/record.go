package domain

import "time"

// NormalizedRecord is one statement line in the form every source parser produces.
type NormalizedRecord struct {
	ExternalID  string // the source's own identifier (OFX FITID, CSV id column); empty when absent
	Date        time.Time
	Amount      int64 // minor units, from the account's point of view: negative leaves the account
	Description string
	Raw         map[string]string // the source fields, stored unchanged
}

// Balance is the balance a file reports at the end of a date.
type Balance struct {
	Date   time.Time
	Amount int64
}

// Statement is the content of one file.
type Statement struct {
	Currency string // empty when the file does not declare it
	From, To *time.Time
	Records  []NormalizedRecord
	Balance  *Balance
}
