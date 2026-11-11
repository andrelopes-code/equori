package reporting

// UseIndicatorSources lends the indicators their two sources; internal/server binds them late
// because planning and portfolio are built after reporting.
func (m *Module) UseIndicatorSources(c Commitments, v Valuations) {
	m.svc.UseIndicatorSources(priced{c, v}, priced{c, v})
}
