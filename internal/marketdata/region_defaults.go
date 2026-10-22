package marketdata

// DefaultCalendar returns the calendar a record takes when the owner's region is region.
func (m *Module) DefaultCalendar(region string) string {
	if region == "BR" {
		return CalendarBRBanking
	}
	return "weekend"
}
