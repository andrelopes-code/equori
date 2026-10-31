package domain

import (
	"bytes"
	"crypto/sha256"
	"regexp"
	"testing"
)

func TestHashRecoveryCode(t *testing.T) {
	t.Parallel()

	want := sha256.Sum256([]byte("ABCDEFGHIJKLMNOP"))

	tests := []struct {
		name   string
		code   string
		wantOK bool
	}{
		{"lower case with separators", "abcd-efgh ijkl-mnop", true},
		{"upper case", "ABCDEFGHIJKLMNOP", true},
		{"too short", "ABCD", false},
		{"digit outside base32", "ABCDEFGHIJKLMNO1", false},
		{"too long", "ABCDEFGHIJKLMNOPQ", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			hash, ok := HashRecoveryCode(tt.code)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}

			if ok && !bytes.Equal(hash, want[:]) {
				t.Fatalf("hash = %x, want %x", hash, want)
			}
		})
	}
}

func TestNewRecoveryCodes(t *testing.T) {
	t.Parallel()

	codes, hashes := NewRecoveryCodes()
	if len(codes) != RecoveryCodeCount || len(hashes) != RecoveryCodeCount {
		t.Fatalf("got %d codes and %d hashes, want %d", len(codes), len(hashes), RecoveryCodeCount)
	}

	format := regexp.MustCompile(`^[A-Z2-7]{16}$`)
	seen := map[string]bool{}

	for i, code := range codes {
		if !format.MatchString(code) {
			t.Errorf("code %q is not 16 characters of A-Z2-7", code)
		}

		if seen[code] {
			t.Errorf("code %q repeats", code)
		}

		seen[code] = true

		if hash, ok := HashRecoveryCode(code); !ok || !bytes.Equal(hash, hashes[i]) {
			t.Errorf("hash %d does not match its code", i)
		}
	}
}
