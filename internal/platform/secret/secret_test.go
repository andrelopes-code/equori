package secret_test

import (
	"bytes"
	"errors"
	"testing"

	"github.com/andrelopes-code/equori/internal/platform/secret"
)

func key(b byte) []byte { return bytes.Repeat([]byte{b}, 32) }

func TestSealAndOpen(t *testing.T) {
	t.Parallel()
	box, err := secret.New(key(1), nil)
	if err != nil {
		t.Fatal(err)
	}
	ad := []byte("ingestion_integration|1|0199")
	sealed, err := box.Seal([]byte("client-secret"), ad)
	if err != nil {
		t.Fatal(err)
	}
	again, err := box.Seal([]byte("client-secret"), ad)
	if err != nil || bytes.Equal(sealed, again) {
		t.Fatalf("two seals are equal (nonce reuse): %v", err)
	}
	if bytes.Contains(sealed, []byte("client-secret")) {
		t.Fatal("plaintext visible in the sealed value")
	}
	got, err := box.Open(sealed, ad)
	if err != nil || string(got) != "client-secret" || box.NeedsReseal(sealed) {
		t.Fatalf("Open = %q, %v; needs reseal %v", got, err, box.NeedsReseal(sealed))
	}

	tampered := bytes.Clone(sealed)
	tampered[len(tampered)-1] ^= 1
	other, _ := secret.New(key(2), nil)
	for name, open := range map[string]func() ([]byte, error){
		"tampered":        func() ([]byte, error) { return box.Open(tampered, ad) },
		"other row":       func() ([]byte, error) { return box.Open(sealed, []byte("ingestion_integration|2|0199")) },
		"other key":       func() ([]byte, error) { return other.Open(sealed, ad) },
		"truncated":       func() ([]byte, error) { return box.Open(sealed[:5], ad) },
		"unknown version": func() ([]byte, error) { return box.Open(append([]byte{9}, sealed[1:]...), ad) },
	} {
		if _, err := open(); !errors.Is(err, secret.ErrUnreadable) {
			t.Errorf("%s: err = %v, want ErrUnreadable", name, err)
		}
	}
}

// ADR 008: the previous key opens old values, which then need resealing.
func TestKeyRotation(t *testing.T) {
	t.Parallel()
	old, _ := secret.New(key(1), nil)
	sealed, err := old.Seal([]byte("s"), []byte("ad"))
	if err != nil {
		t.Fatal(err)
	}
	rotated, err := secret.New(key(2), key(1))
	if err != nil {
		t.Fatal(err)
	}
	if got, err := rotated.Open(sealed, []byte("ad")); err != nil || string(got) != "s" || !rotated.NeedsReseal(sealed) {
		t.Fatalf("Open = %q, %v; needs reseal %v", got, err, rotated.NeedsReseal(sealed))
	}
	resealed, err := rotated.Seal([]byte("s"), []byte("ad"))
	if err != nil || rotated.NeedsReseal(resealed) {
		t.Fatalf("resealed needs reseal: %v", err)
	}
	if _, err := old.Open(resealed, []byte("ad")); !errors.Is(err, secret.ErrUnreadable) {
		t.Fatalf("old key opened a value sealed with the new one: %v", err)
	}
}

func TestNewRejectsBadKeys(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct{ current, previous []byte }{{nil, nil}, {key(1)[:31], nil}, {key(1), key(2)[:16]}, {key(1), key(1)}} {
		if _, err := secret.New(tc.current, tc.previous); err == nil {
			t.Errorf("New(%d bytes, %d bytes) accepted", len(tc.current), len(tc.previous))
		}
	}
}
