package toolapi

import "regexp"

// appearanceValues is the closed value set of each choice set_appearance writes, keyed by the
// name the web stores it under (web/src/theme/appearance.ts). A web test reads the same sets from
// web/src/theme/appearance-values.json and checks that the web accepts each value (assistant
// parity design, AP2). visual holds standard only: the owner blocked the glass style on
// 2026-11-16 (web/src/theme/visual.ts).
var appearanceValues = map[string][]string{
	"scheme":  {"dark", "light", "high-contrast", "system"},
	"density": {"comfortable", "compact", "dense"},
	"textSize": {
		"85",
		"90",
		"95",
		"100",
		"105",
		"110",
		"115",
		"120",
		"125",
		"130",
		"135",
		"140",
	},
	"motion":         {"system", "reduced"},
	"corners":        {"square", "soft", "standard", "round"},
	"typeface":       {"geist", "system", "grotesque", "humanist", "rounded", "mono"},
	"amountTone":     {"colour", "sign"},
	"summaryAmounts": {"full", "whole", "compact"},
	"visual":         {"standard"},
	"accent":         {"indigo", "violet", "pink", "rose", "orange", "emerald", "cyan", "blue"},
}

// accentColour is the other form of an accent: a colour the member picked, as #rrggbb.
var accentColour = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

type appearanceScheme string

func (appearanceScheme) Values() []string { return appearanceValues["scheme"] }

type appearanceDensity string

func (appearanceDensity) Values() []string { return appearanceValues["density"] }

type appearanceTextSize string

func (appearanceTextSize) Values() []string { return appearanceValues["textSize"] }

type appearanceMotion string

func (appearanceMotion) Values() []string { return appearanceValues["motion"] }

type appearanceCorners string

func (appearanceCorners) Values() []string { return appearanceValues["corners"] }

type appearanceTypeface string

func (appearanceTypeface) Values() []string { return appearanceValues["typeface"] }

type appearanceAmountTone string

func (appearanceAmountTone) Values() []string { return appearanceValues["amountTone"] }

type appearanceSummaryAmounts string

func (appearanceSummaryAmounts) Values() []string { return appearanceValues["summaryAmounts"] }

type appearanceVisual string

func (appearanceVisual) Values() []string { return appearanceValues["visual"] }
