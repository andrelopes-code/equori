package secret

import (
	"bytes"
	"encoding/binary"
	"errors"
	"testing"
)

func TestPassphraseRoundTrip(t *testing.T) {
	t.Parallel()

	sealed, err := SealWithPassphrase([]byte(`{"a":1}`), "correct horse")
	if err != nil {
		t.Fatal(err)
	}

	got, err := OpenWithPassphrase(sealed, "correct horse")
	if err != nil || string(got) != `{"a":1}` {
		t.Fatalf("open = %q, %v", got, err)
	}

	again, err := SealWithPassphrase([]byte(`{"a":1}`), "correct horse")
	if err != nil || bytes.Equal(sealed, again) {
		t.Fatalf("two seals equal or failed: %v", err)
	}
}

func TestOpenWithPassphraseRejects(t *testing.T) {
	t.Parallel()

	sealed, err := SealWithPassphrase([]byte("secret"), "correct horse")
	if err != nil {
		t.Fatal(err)
	}

	tampered := bytes.Clone(sealed)
	tampered[len(tampered)-1] ^= 1

	iterations := bytes.Clone(sealed)
	binary.BigEndian.PutUint32(iterations[1:5], 1<<31)

	format := bytes.Clone(sealed)
	format[0] = 2

	tests := []struct {
		name       string
		sealed     []byte
		passphrase string
	}{
		{"wrong passphrase", sealed, "wrong horse"},
		{"empty passphrase", sealed, ""},
		{"tampered ciphertext", tampered, "correct horse"},
		{"other iteration count", iterations, "correct horse"},
		{"other format", format, "correct horse"},
		{"truncated", sealed[:20], "correct horse"},
		{"empty", nil, "correct horse"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if _, err := OpenWithPassphrase(tc.sealed, tc.passphrase); !errors.Is(err, ErrUnreadable) {
				t.Fatalf("err = %v, want ErrUnreadable", err)
			}
		})
	}
}
