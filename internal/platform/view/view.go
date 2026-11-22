// Package view holds the typed views a read tool's output becomes in an assistant answer.
package view

import (
	"encoding/json"
	"time"
)

// Key names a builder: the read tool whose output it presents and the form it draws.
type Key struct {
	Tool, Form string
}

// Select is what the model narrows in a view: the rows kept and the one highlighted.
type Select struct {
	Limit     int    `json:"limit,omitzero"`
	Highlight string `json:"highlight,omitzero"`
}

// Builder turns the outputs of one or two reads into a view (answer views design, V4).
type Builder func(outputs []json.RawMessage, sel Select, today time.Time) (Payload, error)

// Payload is a view as the client draws it (V6). Figures are typed values, never formatted text (V7).
type Payload struct {
	Title   Text     `json:"title"`
	Window  Window   `json:"window"`
	Verdict Text     `json:"verdict"`
	Prov    *Text    `json:"prov,omitempty"`
	Open    *Link    `json:"open,omitempty"`
	Next    []string `json:"next"`
	Rows    Table    `json:"rows"`
	Plot    *Plot    `json:"plot,omitempty"`
	Data    any      `json:"data"`
}

// Text is a catalog key and its typed params.
type Text struct {
	Key    string           `json:"key"`
	Params map[string]Value `json:"params,omitempty"`
}

// Value is one typed figure: text, an amount, a share in basis points, a count or a date.
type Value struct {
	Text  string `json:"text,omitempty"`
	Money *Money `json:"money,omitempty"`
	BP    *int64 `json:"bp,omitempty"`
	Count *int64 `json:"count,omitempty"`
	Date  string `json:"date,omitempty"`
	// Month is a calendar month written YYYY-MM.
	Month string `json:"month,omitempty"`
	// Times is a multiple in basis points: 107098 reads 10.7×.
	Times *int64 `json:"times,omitempty"`
	// Rate is a return in basis points, written with up to two decimals: 1429 reads 14.29%.
	Rate *int64 `json:"rate,omitempty"`
	// Points is a difference of two rates in basis points: 19 reads 0.19 p.p.
	Points *int64 `json:"points,omitempty"`
	// Decimal is a number written with a dot ("38.92"), such as a price, shown in the locale.
	Decimal string `json:"decimal,omitempty"`
}

// Money is an amount in minor units of its currency.
type Money struct {
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
}

// Window is the period or instant a view covers, as calendar dates.
type Window struct {
	From     string `json:"from,omitempty"`
	To       string `json:"to,omitempty"`
	At       string `json:"at,omitempty"`
	LabelKey string `json:"label_key,omitempty"`
}

// Link names the screen that holds the records of a view.
type Link struct {
	Screen string            `json:"screen"`
	Params map[string]string `json:"params,omitempty"`
}

// Table is the view as rows: the table the client shows in place of the chart and copies.
type Table struct {
	Head []string  `json:"head"`
	Rows [][]Value `json:"rows"`
}
