package app

// addOpeningLosses moves a version 37 archive to version 38, which adds portfolio_opening_loss
// (migration 00161, investment history LO1). An earlier archive holds no row of it, so the step
// leaves every table unchanged.
func addOpeningLosses(tables []ArchiveTable) ([]ArchiveTable, error) {
	return tables, nil
}
