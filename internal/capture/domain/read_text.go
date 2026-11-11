package domain

import (
	"slices"
	"strings"
	"unicode/utf8"
)

func (r *lineReader) readTags() {
	for i, w := range r.words {
		tag, ok := strings.CutPrefix(w.core, "#")
		if n := utf8.RuneCountInString(tag); ok && n >= 1 && n <= maxTagRunes {
			if !slices.Contains(r.line.Tags, tag) {
				r.line.Tags = append(r.line.Tags, tag)
			}

			r.mark(i, i+1, RoleTag)
		}
	}
}

// description joins the free words, and the words asText admits, without the connectors at
// either end (A113).
func (r *lineReader) description(asText func(i int) bool) string {
	return r.join(func(i int) bool { return r.words[i].free() || asText != nil && asText(i) })
}

// descriptionOf is the description without the free words keep refuses.
func (r *lineReader) descriptionOf(keep func(i int) bool) string {
	return r.join(func(i int) bool { return r.words[i].free() && (keep == nil || keep(i)) })
}

func (r *lineReader) join(include func(i int) bool) string {
	var parts []string
	for i, w := range r.words {
		if include(i) && w.core != "" {
			parts = append(parts, w.core)
		}
	}

	for len(parts) > 0 && slices.Contains(connectors, Normalize(parts[0])) {
		parts = parts[1:]
	}

	for len(parts) > 0 && slices.Contains(connectors, Normalize(parts[len(parts)-1])) {
		parts = parts[:len(parts)-1]
	}

	return capitalize(strings.Join(parts, " "))
}

// segments cuts text at word and phrase boundaries; the space inside a phrase takes its role.
func (r *lineReader) segments(text string) []Segment {
	var out []Segment

	add := func(s string, role Role) {
		if s == "" {
			return
		}

		if n := len(out); n > 0 && out[n-1].Role == role {
			out[n-1].Text += s
			return
		}

		out = append(out, Segment{Text: s, Role: role})
	}
	for k, w := range r.words {
		role := w.role
		if role == "" {
			role = RoleText
		}

		add(text[w.start:w.end], role)

		if k+1 < len(r.words) {
			gap := RoleText
			if next := r.words[k+1]; w.phrase >= 0 && next.phrase == w.phrase {
				gap = role
			}

			add(text[w.end:r.words[k+1].start], gap)
		}
	}

	return out
}
