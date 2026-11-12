package domain

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"
)

var tagPattern = regexp.MustCompile(`^[\p{L}\p{N}][\p{L}\p{N}-]*$`)

// NormalizeTag normalizes one tag name as normalizeTags does; field names the error.
func NormalizeTag(name, field string) (string, error) {
	tags, err := normalizeTags([]string{name})
	if err != nil {
		return "", invalid(field, "must use letters, digits and hyphens, up to 60 characters")
	}

	return tags[0], nil
}

// normalizeTags lowercases, turns spaces into hyphens, removes duplicates and sorts.
func normalizeTags(in []string) ([]string, error) {
	out := make([]string, 0, len(in))
	for i, raw := range in {
		tag := strings.ReplaceAll(strings.ToLower(strings.TrimSpace(raw)), " ", "-")
		if utf8.RuneCountInString(tag) > maxTagLength || !tagPattern.MatchString(tag) {
			return nil, invalid(
				fmt.Sprintf("tags[%d]", i),
				"must use letters, digits and hyphens, up to 60 characters",
			)
		}

		out = append(out, tag)
	}

	slices.Sort(out)

	return slices.Compact(out), nil
}
