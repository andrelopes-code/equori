package tool

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

var ErrNoPreview = errors.New("tool has no preview")

// Value is one side of a Change: a text, an amount with its currency, or a date.
type Value struct {
	Text     string `json:"text,omitzero"`
	Amount   string `json:"amount,omitzero"`
	Currency string `json:"currency,omitzero"`
	Date     string `json:"date,omitzero"`
}

func TextValue(s string) Value { return Value{Text: s} }

func MoneyValue(m money.Money) Value {
	return Value{Amount: m.Decimal(), Currency: string(m.Currency())}
}

func DateValue(t time.Time) Value { return Value{Date: t.Format(dateLayout)} }

type Change struct {
	Field  string `json:"field"`
	Before Value  `json:"before,omitzero"`
	After  Value  `json:"after,omitzero"`
}

// Item is a record an operation reads or moves.
type Item struct {
	Description string `json:"description"`
	Date        string `json:"date,omitzero"`
	Amount      Value  `json:"amount,omitzero"`
	Account     string `json:"account,omitzero"`
	Category    string `json:"category,omitzero"`
}

// Recurrence is the rule of a schedule the operation creates or changes.
type Recurrence struct {
	Frequency string `json:"frequency"`
	Interval  int    `json:"interval"`
	Day       int    `json:"day,omitzero"`
}

// Preview describes what a write tool would change, without changing it.
type Preview struct {
	Action      string      `json:"action"`
	Target      string      `json:"target,omitzero"`
	Changes     []Change    `json:"changes"`
	Items       []Item      `json:"items,omitzero"`
	Recurrence  *Recurrence `json:"recurrence,omitzero"`
	Destructive bool        `json:"destructive,omitzero"`
	// Basis is hidden state the changes do not show, such as a version.
	Basis string `json:"-"`
}

// PreviewDigest is the hex SHA-256 of the encoded preview followed by its Basis.
func PreviewDigest(p Preview) string {
	b, _ := json.Marshal(p) // Preview holds only strings, numbers, bools and slices of them.
	sum := sha256.Sum256(append(b, p.Basis...))

	return hex.EncodeToString(sum[:])
}

// NewWrite builds a Write or Destructive tool with a preview of its effect.
func NewWrite[In, Out any](
	s Spec,
	preview func(ctx context.Context, booksID int64, in In) (Preview, error),
	h func(ctx context.Context, booksID int64, in In) (Out, error),
) Tool {
	if s.Effect == ReadOnly {
		panic(fmt.Sprintf("tool %s: a read-only tool has no preview", s.Name))
	}

	t := New(s, h)
	t.preview = func(ctx context.Context, booksID int64, args []byte) (Preview, error) {
		var v In
		if err := json.Unmarshal(args, &v); err != nil {
			return Preview{}, invalidArguments(err.Error())
		}

		return preview(ctx, booksID, v)
	}

	return t
}

func (t Tool) HasPreview() bool { return t.preview != nil }
