package portfolio

// defaultJurisdiction returns the jurisdiction identifier a region starts with.
func defaultJurisdiction(region string) (string, bool) {
	switch region {
	case "BR":
		return "br", true
	}

	return "", false
}

// defaultBenchmark returns the daily index a region compares returns with, or "" (amendment
// A208 R2).
func defaultBenchmark(region string) string {
	switch region {
	case "BR":
		return "cdi"
	}

	return ""
}
