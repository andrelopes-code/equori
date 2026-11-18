package toolapi

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type setAppearanceIn struct {
	Scheme         appearanceScheme         `json:"scheme,omitzero"          jsonschema:"colour scheme"`
	Density        appearanceDensity        `json:"density,omitzero"         jsonschema:"space between controls"`
	TextSize       appearanceTextSize       `json:"text_size,omitzero"       jsonschema:"percent of the browser's size"`
	Motion         appearanceMotion         `json:"motion,omitzero"          jsonschema:"reduced turns animation off"`
	Corners        appearanceCorners        `json:"corners,omitzero"         jsonschema:"roundness"`
	Typeface       appearanceTypeface       `json:"typeface,omitzero"        jsonschema:"typeface"`
	AmountTone     appearanceAmountTone     `json:"amount_tone,omitzero"     jsonschema:"colour is green and red; sign is the sign only"`
	SummaryAmounts appearanceSummaryAmounts `json:"summary_amounts,omitzero" jsonschema:"full with cents, whole without, compact as 1.2k"`
	Visual         appearanceVisual         `json:"visual,omitzero"          jsonschema:"visual style"`
	Accent         string                   `json:"accent,omitzero"          jsonschema:"accent colour: indigo, violet, pink, rose, orange, emerald, cyan, blue, or #rrggbb"`
}

// appearanceOut holds the choices under the names the web stores them, so the conversation
// applies a receipt as it is (AP3).
type appearanceOut struct {
	Scheme         string `json:"scheme,omitzero"`
	Density        string `json:"density,omitzero"`
	TextSize       string `json:"textSize,omitzero"`
	Motion         string `json:"motion,omitzero"`
	Corners        string `json:"corners,omitzero"`
	Typeface       string `json:"typeface,omitzero"`
	AmountTone     string `json:"amountTone,omitzero"`
	SummaryAmounts string `json:"summaryAmounts,omitzero"`
	Visual         string `json:"visual,omitzero"`
	Accent         string `json:"accent,omitzero"`
}

type getAppearanceIn struct{}

// choice is one appearance choice of an input: the tool field, the stored name and the value.
type choice struct {
	field, name, value string
}

func setAppearance(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "set_appearance",
		Description: "Proposes changing the member's appearance of the app; only the choices given change, " +
			"and the saved themes and the accents of each book stay. " +
			"Use it when the user asks to change how the app looks. " +
			"Do not use it for the colour of one account: manage_accounts_and_payees does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, previewAppearance(svc), writeAppearance(svc))
}

func getAppearance(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_appearance",
		Description: "Returns the member's appearance choices that set_appearance writes; a choice never made is absent. " +
			"Use it before changing the look of the app. " +
			"Do not use it for the language or the region: update_profile and manage_book change them.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, _ int64, _ getAppearanceIn) (appearanceOut, error) {
		stored, err := storedAppearance(ctx, svc)
		if err != nil {
			return appearanceOut{}, err
		}

		return appearanceFrom(stored), nil
	})
}

// previewAppearance shows each choice given with the stored value it replaces.
func previewAppearance(
	svc *app.Service,
) func(context.Context, int64, setAppearanceIn) (tool.Preview, error) {
	return func(ctx context.Context, _ int64, in setAppearanceIn) (tool.Preview, error) {
		choices, err := appearanceChoices(in)
		if err != nil {
			return tool.Preview{}, err
		}

		stored, err := storedAppearance(ctx, svc)
		if err != nil {
			return tool.Preview{}, err
		}

		p := tool.Preview{Action: "set_appearance"}
		for _, c := range choices {
			before, _ := stored[c.name].(string)
			p.Changes = append(p.Changes, tool.Change{
				Field:  c.field,
				Before: tool.TextValue(before),
				After:  tool.TextValue(c.value),
			})
		}

		return p, nil
	}
}

// writeAppearance merges the choices given into the stored document and returns them.
func writeAppearance(
	svc *app.Service,
) func(context.Context, int64, setAppearanceIn) (appearanceOut, error) {
	return func(ctx context.Context, _ int64, in setAppearanceIn) (appearanceOut, error) {
		choices, err := appearanceChoices(in)
		if err != nil {
			return appearanceOut{}, err
		}

		stored, err := storedAppearance(ctx, svc)
		if err != nil {
			return appearanceOut{}, err
		}

		written := map[string]any{}
		for _, c := range choices {
			stored[c.name] = c.value
			written[c.name] = c.value
		}

		doc, err := json.Marshal(stored)
		if err != nil {
			return appearanceOut{}, fmt.Errorf("encode appearance: %w", err)
		}

		if err := svc.SetAppearance(ctx, auth.MustMemberID(ctx), doc); err != nil {
			return appearanceOut{}, err
		}

		return appearanceFrom(written), nil
	}
}

// appearanceChoices lists the choices of an input in field order; InvalidArgument names a value
// outside its set, and an input with no choice.
func appearanceChoices(in setAppearanceIn) ([]choice, error) {
	all := []choice{
		{"scheme", "scheme", string(in.Scheme)},
		{"density", "density", string(in.Density)},
		{"text_size", "textSize", string(in.TextSize)},
		{"motion", "motion", string(in.Motion)},
		{"corners", "corners", string(in.Corners)},
		{"typeface", "typeface", string(in.Typeface)},
		{"amount_tone", "amountTone", string(in.AmountTone)},
		{"summary_amounts", "summaryAmounts", string(in.SummaryAmounts)},
		{"visual", "visual", string(in.Visual)},
		{"accent", "accent", in.Accent},
	}

	var choices []choice
	for _, c := range all {
		if c.value == "" {
			continue
		}

		valid := slices.Contains(appearanceValues[c.name], c.value) ||
			c.name == "accent" && accentColour.MatchString(c.value)
		if !valid {
			return nil, tool.InvalidArgument(c.field, "is not one of its values")
		}

		choices = append(choices, c)
	}

	if len(choices) == 0 {
		return nil, tool.InvalidArgument("", "give at least one choice")
	}

	return choices, nil
}

// storedAppearance decodes the stored document of the member; an empty document is an empty map.
func storedAppearance(ctx context.Context, svc *app.Service) (map[string]any, error) {
	doc, err := svc.Appearance(ctx, auth.MustMemberID(ctx))
	if err != nil {
		return nil, err
	}

	stored := map[string]any{}
	if len(doc) == 0 {
		return stored, nil
	}

	if err := json.Unmarshal(doc, &stored); err != nil {
		return nil, fmt.Errorf("decode stored appearance: %w", err)
	}

	return stored, nil
}

func appearanceFrom(doc map[string]any) appearanceOut {
	text := func(name string) string {
		s, _ := doc[name].(string)
		return s
	}

	return appearanceOut{
		Scheme:         text("scheme"),
		Density:        text("density"),
		TextSize:       text("textSize"),
		Motion:         text("motion"),
		Corners:        text("corners"),
		Typeface:       text("typeface"),
		AmountTone:     text("amountTone"),
		SummaryAmounts: text("summaryAmounts"),
		Visual:         text("visual"),
		Accent:         text("accent"),
	}
}
