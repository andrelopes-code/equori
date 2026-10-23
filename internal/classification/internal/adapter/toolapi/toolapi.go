// Package toolapi declares the classification module's tools for language models (ADR 012).
package toolapi

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/app"
	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Names returns the names of the user's categories and payees by ID.
type Names func(ctx context.Context, userID int64) (categories, payees map[uuid.UUID]string, err error)

func Tools(svc *app.Service, names Names, today func() time.Time) []tool.Tool {
	return []tool.Tool{listRules(svc, names), explainCategorization(svc), manageRule(svc, names, today)}
}

func optionalID(s, field string) (uuid.UUID, error) {
	if s == "" {
		return uuid.Nil, nil
	}
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, tool.InvalidArgument(field, "is not a UUID")
	}
	return id, nil
}

// field is an optional input and whether the call gave it.
type field struct {
	name  string
	given bool
}

// required reports a field the view or action needs, and rejects one it does not use.
func required(name string, fields []field, needed ...string) error {
	for _, f := range fields {
		switch {
		case slices.Contains(needed, f.name) && !f.given:
			return tool.InvalidArgument(f.name, "is required for "+name)
		case !slices.Contains(needed, f.name) && f.given:
			return tool.InvalidArgument(f.name, "is not used by "+name)
		}
	}
	return nil
}

func pageRequest[K any](args tool.PageArgs) (page.Request[K], error) {
	n, err := tool.Limit(args.Limit)
	if err != nil {
		return page.Request[K]{}, err
	}
	r := page.Request[K]{Limit: n}
	if args.Cursor != "" {
		var k K
		if page.DecodeCursor(args.Cursor, &k) != nil {
			return page.Request[K]{}, tool.InvalidArgument("cursor", "is not a next_cursor of this list; start again without cursor")
		}
		r.After = &k
	}
	return r, nil
}

func nextCursor[K any](k *K) (string, error) {
	if k == nil {
		return "", nil
	}
	return page.EncodeCursor(k)
}

// conditionsText renders conditions in English, such as: description contains "uber".
func conditionsText(cs []domain.Condition) string {
	parts := make([]string, len(cs))
	for i, c := range cs {
		d := c.Doc()
		var v string
		if s, ok := d.Value.(string); ok {
			v = fmt.Sprintf("%q", s)
		} else {
			b, _ := json.Marshal(d.Value) // a condition value is a string, number or list of them
			v = string(b)
		}
		parts[i] = strings.ReplaceAll(d.Field, "_", " ") + " " + strings.ReplaceAll(d.Operator, "_", " ") + " " + v
	}
	return strings.Join(parts, " and ")
}

// actionsText renders actions in English, such as: set category Transport.
func actionsText(as []domain.Action, categories, payees map[uuid.UUID]string) string {
	parts := make([]string, len(as))
	for i, a := range as {
		d := a.Doc()
		text := strings.ReplaceAll(d.Type, "_", " ")
		switch {
		case d.CategoryID != uuid.Nil:
			text += " " + categories[d.CategoryID]
		case d.PayeeID != uuid.Nil:
			text += " " + payees[d.PayeeID]
		case d.AccountID != uuid.Nil:
			text += " " + categories[d.AccountID]
		case len(d.Tags) > 0:
			text += " " + strings.Join(d.Tags, ", ")
		}
		parts[i] = text
	}
	return strings.Join(parts, ", ")
}

// allRules reads every rule in priority order.
func allRules(ctx context.Context, svc *app.Service, userID int64) ([]domain.Rule, error) {
	var all []domain.Rule
	p := page.Request[app.RuleKey]{Limit: page.MaxLimit}
	for {
		rows, next, err := svc.ListRules(ctx, userID, p)
		if err != nil {
			return nil, err
		}
		all = append(all, rows...)
		if next == nil {
			return all, nil
		}
		p.After = next
	}
}
