package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"maps"
	"slices"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

// resolveRefs returns args with the value at each pointer of refs replaced by the value at the result
// pointer of the referenced proposal. missing names the first pointer whose result value is absent.
func resolveRefs(args []byte, refs map[string]string, results map[uuid.UUID][]byte) (out []byte, missing string, err error) {
	doc, err := decodeJSON(args)
	if err != nil {
		return nil, "", fmt.Errorf("decode arguments: %w", err)
	}

	for _, key := range slices.Sorted(maps.Keys(refs)) {
		rawID, pointer, found := strings.Cut(refs[key], "#")
		if !found {
			pointer = "/id"
		}

		id, err := uuid.Parse(rawID)
		if err != nil {
			return nil, "", fmt.Errorf("parse reference %s: %w", key, err)
		}

		result, err := decodeJSON(results[id])
		if err != nil {
			return nil, "", fmt.Errorf("decode result of proposal %s: %w", id, err)
		}

		value, ok := lookup(result, pointer)
		if !ok {
			return nil, key, nil
		}

		if doc, ok = store(doc, key, value); !ok {
			return nil, "", fmt.Errorf("set %s: not a field of the arguments", key)
		}
	}

	out, err = json.Marshal(doc)

	return out, "", err
}

// hasPointer reports whether the JSON pointer p names a value of doc.
func hasPointer(doc []byte, p string) bool {
	v, err := decodeJSON(doc)
	if err != nil {
		return false
	}

	_, ok := lookup(v, p)

	return ok
}

// decodeJSON keeps numbers as json.Number so that a copied value is not rounded.
func decodeJSON(b []byte) (any, error) {
	d := json.NewDecoder(bytes.NewReader(b))
	d.UseNumber()

	var v any

	return v, d.Decode(&v)
}

// pointerTokens splits an RFC 6901 pointer and decodes the escapes.
func pointerTokens(p string) ([]string, bool) {
	if p == "" {
		return nil, true
	}

	if !strings.HasPrefix(p, "/") {
		return nil, false
	}

	tokens := strings.Split(p[1:], "/")
	for i, t := range tokens {
		tokens[i] = strings.ReplaceAll(strings.ReplaceAll(t, "~1", "/"), "~0", "~")
	}

	return tokens, true
}

// arrayIndex parses a token as an index of an array of n items.
func arrayIndex(token string, n int) (int, bool) {
	i, err := strconv.Atoi(token)
	if err != nil || i < 0 || i >= n || strconv.Itoa(i) != token {
		return 0, false
	}

	return i, true
}

func lookup(doc any, p string) (any, bool) {
	tokens, ok := pointerTokens(p)
	if !ok {
		return nil, false
	}

	return walk(doc, tokens)
}

func walk(doc any, tokens []string) (any, bool) {
	for _, t := range tokens {
		var ok bool

		switch node := doc.(type) {
		case map[string]any:
			if doc, ok = node[t]; !ok {
				return nil, false
			}
		case []any:
			i, ok := arrayIndex(t, len(node))
			if !ok {
				return nil, false
			}

			doc = node[i]
		default:
			return nil, false
		}
	}

	return doc, true
}

// store sets the value at pointer p, which must name an existing value, and returns the document.
func store(doc any, p string, value any) (any, bool) {
	tokens, ok := pointerTokens(p)
	if !ok {
		return doc, false
	}

	if len(tokens) == 0 {
		return value, true
	}

	parent, ok := walk(doc, tokens[:len(tokens)-1])
	last := tokens[len(tokens)-1]

	switch node := parent.(type) {
	case map[string]any:
		if _, exists := node[last]; ok && exists {
			node[last] = value
			return doc, true
		}
	case []any:
		if i, valid := arrayIndex(last, len(node)); ok && valid {
			node[i] = value
			return doc, true
		}
	}

	return doc, false
}
