package identity

// DefaultTimeZone is the IANA name of the location of a book of region whose time_zone is null
// (ADR 016, ADR 029 BK18). A region without a case gets UTC.
func DefaultTimeZone(region string) string {
	switch region {
	case "BR":
		return "America/Sao_Paulo"
	default:
		return "UTC"
	}
}
