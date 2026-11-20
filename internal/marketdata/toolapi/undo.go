package toolapi

// undoInstrument shows again the security hide hid, and hides the one show showed (answer views
// design V19).
func undoInstrument(in manageInstrumentIn, _ struct{}, _ string) (string, any, bool) {
	inverse := map[manageInstrumentAction]manageInstrumentAction{"hide": "show", "show": "hide"}

	action, ok := inverse[in.Action]

	return "manage_instrument", manageInstrumentIn{Action: action, Code: in.Code}, ok
}
