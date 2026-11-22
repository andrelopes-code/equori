package app

// addExternalInvestments moves a version 25 archive to version 26, which adds
// ingestion_external_investment and ingestion_investment_movement (migration 00113). An earlier
// archive holds no row of either, so the step leaves every table unchanged.
func addExternalInvestments(tables []ArchiveTable) ([]ArchiveTable, error) {
	return tables, nil
}
