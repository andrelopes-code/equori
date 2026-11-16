package marketdata

func optional(s string) *string {
	if s == "" {
		return nil
	}

	return &s
}

func optionalID(id int64) *int64 {
	if id == 0 {
		return nil
	}

	return &id
}

func deref(s *string) string {
	if s == nil {
		return ""
	}

	return *s
}
