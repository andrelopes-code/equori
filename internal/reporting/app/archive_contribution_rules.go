package app

// addContributionRules moves a version 30 archive to version 31, which adds
// portfolio_contribution_rule (migration 00131). An earlier archive holds no row of it, so the
// step leaves every table unchanged.
func addContributionRules(tables []ArchiveTable) ([]ArchiveTable, error) {
	return tables, nil
}
