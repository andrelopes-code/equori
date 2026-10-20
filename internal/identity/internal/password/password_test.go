package password

import (
	"errors"
	"strings"
	"testing"
)

func TestHashAndVerify(t *testing.T) {
	t.Parallel()
	encoded := Hash("correct horse battery")

	if !strings.HasPrefix(encoded, "$argon2id$v=19$m=19456,t=2,p=1$") {
		t.Fatalf("unexpected encoding %q", encoded)
	}
	if encoded == Hash("correct horse battery") {
		t.Fatal("two hashes of the same password are equal; salt is not random")
	}

	ok, err := Verify("correct horse battery", encoded)
	if err != nil || !ok {
		t.Fatalf("Verify(correct) = %v, %v; want true, nil", ok, err)
	}
	ok, err = Verify("wrong horse battery", encoded)
	if err != nil || ok {
		t.Fatalf("Verify(wrong) = %v, %v; want false, nil", ok, err)
	}
}

func TestVerifyMalformed(t *testing.T) {
	t.Parallel()
	for _, encoded := range []string{
		"",
		"plain",
		"$bcrypt$v=19$m=1,t=1,p=1$c2FsdA$a2V5",
		"$argon2id$v=18$m=19456,t=2,p=1$c2FsdA$a2V5",
		"$argon2id$v=19$m=x,t=2,p=1$c2FsdA$a2V5",
		"$argon2id$v=19$m=19456,t=2,p=1$!!!$a2V5",
		"$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$",
	} {
		if _, err := Verify("x", encoded); !errors.Is(err, ErrMalformedHash) {
			t.Errorf("Verify(%q) err = %v, want ErrMalformedHash", encoded, err)
		}
	}
}
