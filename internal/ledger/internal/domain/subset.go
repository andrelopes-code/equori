package domain

const maxSubsetValues = 20

// ExactSubset returns the indexes, ascending, of the only non-empty subset of values that adds
// up to target. It reports false when there is none, when several exist or when values holds
// more than twenty items (A117).
func ExactSubset(values []int64, target int64) ([]int, bool) {
	if target <= 0 || len(values) == 0 || len(values) > maxSubsetValues {
		return nil, false
	}
	var found []int
	matches := 0
	for mask := 1; mask < 1<<len(values); mask++ {
		var sum int64
		for i, v := range values {
			if mask&(1<<i) != 0 {
				sum += v
			}
		}
		if sum != target {
			continue
		}
		if matches++; matches > 1 {
			return nil, false
		}
		found = found[:0]
		for i := range values {
			if mask&(1<<i) != 0 {
				found = append(found, i)
			}
		}
	}
	return found, matches == 1
}
