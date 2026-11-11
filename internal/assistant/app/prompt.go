package app

import (
	"bytes"
	_ "embed"
	"fmt"
	"strings"
	"text/template"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

//go:embed guide.tmpl
var guideText string

var guideTemplate = template.Must(template.New("guide").Parse(guideText))

type guideData struct {
	Audience, Today, Language, Region, Page string
	Notices                                 []string
	Book                                    []BookRead
}

// AccountNotice is an account whose figures an answer qualifies (P12 A152).
type AccountNotice struct {
	Name string
	// ConnectionState is the state of the account's connection when not ok, and LastUpdateOn
	// the date of the institution's last update; empty and nil otherwise.
	ConnectionState string
	LastUpdateOn    *time.Time
	// Difference is the open difference of the latest balance assertion, on DifferenceOn.
	Difference   *money.Money
	DifferenceOn time.Time
	Unconfirmed  int
}

// PromptInput holds the values of the system prompt; Page is empty when the screen is unknown.
type PromptInput struct {
	Today  time.Time
	Locale locale.Locale
	Page   string
	// Notices are the accounts the chat prompt names with their warning (A152).
	Notices []AccountNotice
	// Book holds the outputs of the turn-start reads, in order (spec 2026-11-03 §8).
	Book []BookRead
}

// BookRead is one turn-start read: the tool and its output, or the replacement text of spec §8.
type BookRead struct{ Tool, Text string }

// Prompt renders the system prompt of a turn (spec 10).
func Prompt(p PromptInput) string {
	notices := make([]string, len(p.Notices))
	for i, n := range p.Notices {
		notices[i] = n.line()
	}

	return guide(guideData{
		Audience: "chat",
		Today:    p.Today.Format(time.DateOnly),
		Language: p.Locale.Language,
		Region:   p.Locale.Region,
		Page:     p.Page,
		Notices:  notices,
		Book:     p.Book,
	})
}

// Instructions renders the guide for an MCP client (design 2026-10-26 E9, E10).
func Instructions() string {
	return guide(guideData{Audience: "mcp"})
}

func guide(data guideData) string {
	var b bytes.Buffer
	if err := guideTemplate.Execute(&b, data); err != nil {
		panic(err) // the template and its data are fixed at build time
	}

	return b.String()
}

// line renders the notice as "<Name>: <parts>." for the prompt.
func (n AccountNotice) line() string {
	var parts []string
	if n.ConnectionState != "" {
		parts = append(parts, "connection "+n.ConnectionState)
	}

	if n.LastUpdateOn != nil {
		parts = append(parts, "last institution update "+n.LastUpdateOn.Format(time.DateOnly))
	}

	if n.Difference != nil {
		parts = append(parts, fmt.Sprintf("open difference of %s %s on %s",
			n.Difference.Decimal(), n.Difference.Currency(), n.DifferenceOn.Format(time.DateOnly)))
	}

	if n.Unconfirmed > 0 {
		parts = append(parts, fmt.Sprintf("unconfirmed entries: %d", n.Unconfirmed))
	}

	return n.Name + ": " + strings.Join(parts, "; ") + "."
}
