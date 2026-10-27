package locale

// DateOrder is the order of day, month and year in a numeric date.
type DateOrder string

const (
	DMY DateOrder = "dmy"
	MDY DateOrder = "mdy"
	YMD DateOrder = "ymd"
)

// Conventions are the number and date conventions of a locale.
type Conventions struct {
	Decimal, Group rune
	Order          DateOrder
}

// DateLayout returns the time layout of a numeric date in the conventions' order.
func (c Conventions) DateLayout() string {
	switch c.Order {
	case DMY:
		return "02/01/2006"
	case MDY:
		return "01/02/2006"
	}
	return "2006-01-02"
}

// ConventionsOf returns the conventions of the locale's region.
func ConventionsOf(l Locale) Conventions {
	switch l.Region {
	case "BR", "PT", "DE", "FR", "ES", "IT", "NL", "AR":
		return Conventions{',', '.', DMY}
	case "CH":
		return Conventions{'.', '\'', DMY}
	case "GB", "AU", "MX":
		return Conventions{'.', ',', DMY}
	case "US", "CA":
		return Conventions{'.', ',', MDY}
	}
	return Conventions{'.', ',', YMD}
}

// EnglishName returns the English name of the locale, for example "Portuguese (Brazil)".
// A region without a name falls back to its code.
func EnglishName(l Locale) string {
	region, ok := regionName(l.Region)
	if !ok {
		region = l.Region
	}
	return languageName(l.Language) + " (" + region + ")"
}

func languageName(language string) string {
	switch language {
	case "en":
		return "English"
	case "pt":
		return "Portuguese"
	case "es":
		return "Spanish"
	case "de":
		return "German"
	case "fr":
		return "French"
	case "it":
		return "Italian"
	}
	return language
}
