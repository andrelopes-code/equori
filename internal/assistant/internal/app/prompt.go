package app

import (
	"bytes"
	_ "embed"
	"text/template"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/locale"
)

//go:embed guide.tmpl
var guideText string

var guideTemplate = template.Must(template.New("guide").Parse(guideText))

type guideData struct{ Audience, Today, Language, Region, Page string }

// PromptInput holds the values of the system prompt; Page is empty when the screen is unknown.
type PromptInput struct {
	Today  time.Time
	Locale locale.Locale
	Page   string
}

// Prompt renders the system prompt of a turn (spec 10).
func Prompt(p PromptInput) string {
	return guide(guideData{Audience: "chat", Today: p.Today.Format(time.DateOnly), Language: p.Locale.Language, Region: p.Locale.Region, Page: p.Page})
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
