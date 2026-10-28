package marketdata

import "slices"

// DefaultCalendar returns the calendar a record takes when the owner's region is region.
func (m *Module) DefaultCalendar(region string) string {
	if region == "BR" {
		return CalendarBRBanking
	}
	return "weekend"
}

// SuggestedFeeds names the feeds suggested to a user of region (ADR 025 F3); a suggestion
// enables nothing.
func SuggestedFeeds(region string) []string {
	switch {
	case region == "BR":
		return []string{"b3_consolidated", "bcb_ptax", "br_cdi", "br_ipca", "br_focus"}
	case region == "US":
		return []string{"us_sofr", "us_cpi"}
	case slices.Contains(euroArea, region):
		return []string{"ecb", "eu_estr", "ea_hicp"}
	}
	return nil
}

// euroArea lists the members of the euro area on 2026-01-01.
var euroArea = []string{"AT", "BE", "BG", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"}
