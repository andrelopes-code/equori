package portfolio

// defaultJurisdiction returns the jurisdiction identifier a region starts with.
func defaultJurisdiction(region string) (string, bool) {
	switch region {
	case "BR":
		return "br", true
	}
	return "", false
}
