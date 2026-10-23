package tool

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

var ErrNoPreview = errors.New("tool has no preview")

// ParseAmount reads a decimal string in the code and scale of unit.
func ParseAmount(field, s string, unit money.Money) (money.Money, error) {
	m, err := money.ParseDecimal(s, unit.Currency(), unit.Scale())
	if err != nil {
		return money.Money{}, InvalidArgument(field, fmt.Sprintf("must be a decimal such as 125.90 with at most %d decimals", unit.Scale()))
	}
	return m, nil
}

// ParsePositive is ParseAmount for a value that must be greater than zero.
func ParsePositive(field, s string, unit money.Money) (money.Money, error) {
	m, err := ParseAmount(field, s, unit)
	if err != nil {
		return money.Money{}, err
	}
	if m.Amount() <= 0 {
		return money.Money{}, InvalidArgument(field, "must be greater than zero")
	}
	return m, nil
}

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

// Preview describes what a write tool would change, without changing it.
type Preview struct {
	Action      string   `json:"action"`
	Target      string   `json:"target,omitzero"`
	Changes     []Change `json:"changes"`
	Destructive bool     `json:"destructive,omitzero"`
	// Basis is hidden state the changes do not show, such as a version.
	Basis string `json:"-"`
}

// ChangeFields is the closed vocabulary of Change.Field.
var ChangeFields = []string{
	"account", "amount", "category", "date", "description", "payee", "tags", "status", "name", "class",
	"kind", "currency", "parent", "institution", "limit", "closing_day", "due_day", "card", "installments",
	"statement", "quantity", "price", "rule", "pattern", "priority", "schedule", "occurrence", "budget",
	"goal", "target", "due_on", "accounts", "language", "region", "connection", "record", "reason",
	"instrument", "terms", "count", "rate", "transaction",
}

// PreviewDigest is the hex SHA-256 of the encoded preview followed by its Basis.
func PreviewDigest(p Preview) string {
	b, _ := json.Marshal(p) // Preview holds only strings, bools and slices of them.
	sum := sha256.Sum256(append(b, p.Basis...))
	return hex.EncodeToString(sum[:])
}

// NewWrite builds a Write or Destructive tool with a preview of its effect.
func NewWrite[In, Out any](s Spec, preview func(ctx context.Context, userID int64, in In) (Preview, error),
	h func(ctx context.Context, userID int64, in In) (Out, error)) Tool {
	if s.Effect == ReadOnly {
		panic(fmt.Sprintf("tool %s: a read-only tool has no preview", s.Name))
	}
	t := New(s, h)
	t.preview = func(ctx context.Context, userID int64, args []byte) (Preview, error) {
		var v In
		if err := json.Unmarshal(args, &v); err != nil {
			return Preview{}, invalidArguments(err.Error())
		}
		return preview(ctx, userID, v)
	}
	return t
}

func (t Tool) HasPreview() bool { return t.preview != nil }

// Preview validates the arguments like Call and returns what the tool would change.
func (r *Registry) Preview(ctx context.Context, name string, args json.RawMessage) (Preview, Result, error) {
	e, ok := r.entries[name]
	if !ok {
		return Preview{}, Result{}, fmt.Errorf("preview tool %s: %w", name, ErrUnknownTool)
	}
	userID, ok := auth.UserID(ctx)
	if !ok {
		return Preview{}, Result{}, fmt.Errorf("preview tool %s: %w", name, ErrNoUser)
	}
	if !e.tool.HasPreview() {
		return Preview{}, Result{}, fmt.Errorf("preview tool %s: %w", name, ErrNoPreview)
	}
	start := time.Now()
	p, res, outcome, err := r.preview(ctx, e, userID, args)
	if err != nil {
		outcome = "canceled"
	}
	r.log.LogAttrs(ctx, slog.LevelInfo, "tool preview", slog.String("tool", name), slog.Int64("user_id", userID),
		slog.String("effect", e.tool.spec.Effect.String()), slog.String("outcome", outcome),
		slog.Duration("duration", time.Since(start)), slog.Int("bytes", len(res.Content)))
	return p, res, err
}

func (r *Registry) preview(ctx context.Context, e entry, userID int64, args json.RawMessage) (Preview, Result, string, error) {
	name := e.tool.spec.Name
	args, bad := e.tool.validate(args)
	if bad != nil {
		res, outcome, err := failure(*bad)
		return Preview{}, res, outcome, err
	}
	p, err := e.tool.preview(ctx, userID, args)
	if err != nil {
		res, outcome, err := r.mapError(ctx, e, err)
		return Preview{}, res, outcome, err
	}
	for _, c := range p.Changes {
		if !slices.Contains(ChangeFields, c.Field) {
			res, outcome, err := r.internal(ctx, name, fmt.Errorf("preview field %q is not in ChangeFields", c.Field))
			return Preview{}, res, outcome, err
		}
	}
	return p, Result{}, "ok", nil
}

// Preview checks membership like Call.
func (s Set) Preview(ctx context.Context, name string, args json.RawMessage) (Preview, Result, error) {
	if !slices.Contains(s.names, name) {
		return Preview{}, Result{}, fmt.Errorf("preview tool %s: %w", name, ErrUnknownTool)
	}
	return s.r.Preview(ctx, name, args)
}
