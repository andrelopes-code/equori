package domain

import (
	"bytes"
	"crypto"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"slices"
	"testing"
)

const (
	testOrigin = "https://books.example"
	testRPID   = "books.example"
)

func TestRPID(t *testing.T) {
	t.Parallel()

	tests := []struct {
		origin string
		want   string
		ok     bool
	}{
		{"https://books.example", "books.example", true},
		{"http://127.0.0.1:8080", "127.0.0.1", true},
		{"", "", false},
		{"null", "", false},
		{"ftp://books.example", "", false},
		{"https://", "", false},
	}

	for _, tt := range tests {
		got, ok := RPID(tt.origin)
		if got != tt.want || ok != tt.ok {
			t.Errorf("RPID(%q) = %q, %t; want %q, %t", tt.origin, got, ok, tt.want, tt.ok)
		}
	}
}

func TestVerifyRegistration(t *testing.T) {
	t.Parallel()

	challenge := bytes.Repeat([]byte{7}, 32)

	tests := []struct {
		name    string
		alg     int // key of the ceremony
		declare int // algorithm sent to the verifier; zero is alg
		typ     string
		chal    []byte
		origin  string
		rpID    string
		flags   byte
		idLen   int
		wantErr bool
	}{
		{name: "valid es256", alg: AlgES256},
		{name: "valid eddsa", alg: AlgEdDSA},
		{name: "valid rs256", alg: AlgRS256},
		{name: "type get", alg: AlgES256, typ: "webauthn.get", wantErr: true},
		{name: "another challenge", alg: AlgES256, chal: bytes.Repeat([]byte{8}, 32), wantErr: true},
		{name: "another origin", alg: AlgES256, origin: "https://other.example", wantErr: true},
		{name: "another rp id", alg: AlgES256, rpID: "other.example", wantErr: true},
		{name: "no user presence", alg: AlgES256, flags: 0x40, wantErr: true},
		{name: "no attested data", alg: AlgES256, flags: 0x01, wantErr: true},
		{name: "key of another algorithm", alg: AlgEdDSA, declare: AlgES256, wantErr: true},
		{name: "unsupported algorithm", alg: AlgES256, declare: -35, wantErr: true},
		{name: "credential id longer than the data", alg: AlgES256, idLen: 200, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			key := newSoftKey(t, tt.alg)
			typ := orDefault(tt.typ, "webauthn.create")

			chal := tt.chal
			if chal == nil {
				chal = challenge
			}

			rpID := orDefault(tt.rpID, testRPID)

			flags := tt.flags
			if flags == 0 {
				flags = 0x41
			}

			data := key.registrationData(rpID, flags)
			if tt.idLen != 0 {
				binary.BigEndian.PutUint16(data[53:55], uint16(tt.idLen))
			}

			declared := tt.declare
			if declared == 0 {
				declared = tt.alg
			}

			got, err := VerifyRegistration(
				key.clientData(typ, chal, orDefault(tt.origin, testOrigin)),
				data, key.spki(t), declared, challenge, testOrigin,
			)

			if tt.wantErr {
				if !errors.Is(err, ErrWebAuthn) {
					t.Fatalf("err = %v; want ErrWebAuthn", err)
				}

				return
			}

			if err != nil {
				t.Fatal(err)
			}

			if !slices.Equal(got.CredentialID, key.credentialID) || got.Algorithm != tt.alg ||
				got.SignCount != 0 || !slices.Equal(got.PublicKey, key.spki(t)) {
				t.Fatalf("registration = %+v", got)
			}
		})
	}
}

func TestVerifyAssertion(t *testing.T) {
	t.Parallel()

	challenge := bytes.Repeat([]byte{7}, 32)

	tests := []struct {
		name    string
		typ     string
		chal    []byte
		origin  string
		rpID    string
		flags   *byte
		corrupt bool
		wantErr bool
	}{
		{name: "valid"},
		{name: "type create", typ: "webauthn.create", wantErr: true},
		{name: "another challenge", chal: bytes.Repeat([]byte{8}, 32), wantErr: true},
		{name: "another origin", origin: "https://other.example", wantErr: true},
		{name: "another rp id", rpID: "other.example", wantErr: true},
		{name: "no user presence", flags: new(byte), wantErr: true},
		{name: "corrupt signature", corrupt: true, wantErr: true},
	}

	for _, alg := range []int{AlgES256, AlgEdDSA, AlgRS256} {
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				t.Parallel()

				key := newSoftKey(t, alg)

				chal := tt.chal
				if chal == nil {
					chal = challenge
				}

				flags := byte(0x01)
				if tt.flags != nil {
					flags = *tt.flags
				}

				client := key.clientData(orDefault(tt.typ, "webauthn.get"), chal, orDefault(tt.origin, testOrigin))
				data := key.assertionData(orDefault(tt.rpID, testRPID), flags, 5)

				sig := key.sign(data, client)
				if tt.corrupt {
					sig[len(sig)-1] ^= 0xff
				}

				got, err := VerifyAssertion(client, data, sig, key.spki(t), alg, challenge, testOrigin)

				if tt.wantErr {
					if !errors.Is(err, ErrWebAuthn) {
						t.Fatalf("alg %d: err = %v; want ErrWebAuthn", alg, err)
					}

					return
				}

				if err != nil || got != 5 {
					t.Fatalf("alg %d: counter = %d, err = %v; want 5", alg, got, err)
				}
			})
		}
	}
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}

	return v
}

// softKey is a software authenticator.
type softKey struct {
	alg          int
	private      crypto.Signer
	credentialID []byte
}

func newSoftKey(t *testing.T, alg int) softKey {
	t.Helper()

	var (
		private crypto.Signer
		err     error
	)

	switch alg {
	case AlgES256:
		private, err = ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	case AlgEdDSA:
		_, private, err = ed25519.GenerateKey(rand.Reader)
	case AlgRS256:
		private, err = rsa.GenerateKey(rand.Reader, 2048)
	}

	if err != nil {
		t.Fatal(err)
	}

	return softKey{alg: alg, private: private, credentialID: []byte{1, 2, 3, 4}}
}

func (k softKey) spki(t *testing.T) []byte {
	t.Helper()

	der, err := x509.MarshalPKIXPublicKey(k.private.Public())
	if err != nil {
		t.Fatal(err)
	}

	return der
}

func (k softKey) clientData(typ string, challenge []byte, origin string) []byte {
	b, _ := json.Marshal(map[string]string{
		"type":      typ,
		"challenge": base64.RawURLEncoding.EncodeToString(challenge),
		"origin":    origin,
	})

	return b
}

func (k softKey) registrationData(rpID string, flags byte) []byte {
	hash := sha256.Sum256([]byte(rpID))
	data := append(hash[:], flags, 0, 0, 0, 0)
	data = append(data, make([]byte, 16)...)
	data = binary.BigEndian.AppendUint16(data, uint16(len(k.credentialID)))
	data = append(data, k.credentialID...)

	return append(data, 0xa0)
}

func (k softKey) assertionData(rpID string, flags byte, counter uint32) []byte {
	hash := sha256.Sum256([]byte(rpID))
	data := append(hash[:], flags)

	return binary.BigEndian.AppendUint32(data, counter)
}

func (k softKey) sign(authData, clientData []byte) []byte {
	clientHash := sha256.Sum256(clientData)
	msg := append(slices.Clone(authData), clientHash[:]...)

	switch k.alg {
	case AlgEdDSA:
		return ed25519.Sign(k.private.(ed25519.PrivateKey), msg)
	case AlgRS256:
		digest := sha256.Sum256(msg)
		sig, _ := rsa.SignPKCS1v15(rand.Reader, k.private.(*rsa.PrivateKey), crypto.SHA256, digest[:])

		return sig
	default:
		digest := sha256.Sum256(msg)
		sig, _ := ecdsa.SignASN1(rand.Reader, k.private.(*ecdsa.PrivateKey), digest[:])

		return sig
	}
}
