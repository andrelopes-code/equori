// Package charset decodes the text encodings that bank exports use (P4 amendment A15).
package charset

import (
	"bytes"
	"fmt"
	"unicode/utf8"
)

var utf8BOM = []byte{0xEF, 0xBB, 0xBF}

// Decode returns data as UTF-8. A UTF-8 byte order mark selects UTF-8 whatever name says.
// "auto", or an empty name, keeps valid UTF-8 and decodes anything else as Windows-1252.
func Decode(data []byte, name string) (string, error) {
	if rest, ok := bytes.CutPrefix(data, utf8BOM); ok {
		return string(rest), nil
	}
	if name == "auto" || name == "" {
		if utf8.Valid(data) {
			return string(data), nil
		}
		name = "windows-1252"
	}
	enc, ok := Decoder(name)
	if !ok {
		return "", fmt.Errorf("decode: unknown encoding %q", name)
	}
	out, err := enc.NewDecoder().Bytes(data)
	if err != nil {
		return "", fmt.Errorf("decode %s: %w", name, err)
	}
	return string(out), nil
}
