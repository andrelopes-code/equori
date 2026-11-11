package domain

// Reidentifications pairs a line of a read with the stored record that carries its
// institution line id (A143): the record is neither discarded nor in review, its external id
// is not in seen, no stored record holds the line's external id, and no other line or record
// carries that institution line id. The map is keyed by line index.
func Reidentifications(lines []NormalizedRecord, seen []string, stored []ExternalRecord) map[int]ExternalRecord {
	returned := make(map[string]bool, len(seen))
	for _, id := range seen {
		returned[id] = true
	}

	held := make(map[string]bool, len(stored))
	byInstitution := map[string][]ExternalRecord{}

	for _, rec := range stored {
		held[rec.ExternalID] = true

		if rec.InstitutionID != "" {
			byInstitution[rec.InstitutionID] = append(byInstitution[rec.InstitutionID], rec)
		}
	}

	carriers := map[string]int{}

	for _, l := range lines {
		if l.InstitutionID != "" {
			carriers[l.InstitutionID]++
		}
	}

	paired := map[int]ExternalRecord{}

	for i, l := range lines {
		recs := byInstitution[l.InstitutionID]
		if l.InstitutionID == "" || carriers[l.InstitutionID] != 1 || len(recs) != 1 || held[l.ExternalID] {
			continue
		}

		rec := recs[0]
		if rec.State == StateDiscarded || rec.State == StateNeedsReview || returned[rec.ExternalID] {
			continue
		}

		paired[i] = rec
	}

	return paired
}
