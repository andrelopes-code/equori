package app

import (
	"bytes"
	_ "embed"
	"text/template"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/locale"
)

//go:embed prompt.tmpl
var promptText string

var promptTemplate = template.Must(template.New("prompt").Parse(promptText))

// PromptInput holds the values of the system prompt; Page is empty when the screen is unknown.
type PromptInput struct {
	Today  time.Time
	Locale locale.Locale
	Page   string
}

// Prompt renders the system prompt of a turn (spec 10).
func Prompt(p PromptInput) string {
	var b bytes.Buffer
	data := struct{ Today, Language, Region, Page string }{p.Today.Format(time.DateOnly), p.Locale.Language, p.Locale.Region, p.Page}
	if err := promptTemplate.Execute(&b, data); err != nil {
		panic(err) // the template and its data are fixed at build time
	}
	return b.String()
}
