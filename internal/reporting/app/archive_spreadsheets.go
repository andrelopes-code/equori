package app

// addSpreadsheets moves a version 32 archive to version 33, which adds spreadsheet_document
// (migration 00142). An earlier archive holds no row of it, so the step leaves every table
// unchanged.
func addSpreadsheets(tables []ArchiveTable) ([]ArchiveTable, error) {
	return tables, nil
}
