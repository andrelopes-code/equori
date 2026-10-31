package identity_test

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"net/http"
	"slices"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type passkeyOptions struct {
	Challenge          string   `json:"challenge"`
	UserID             string   `json:"user_id"`
	UserName           string   `json:"user_name"`
	ExcludeCredentials []string `json:"exclude_credentials"`
}

type passkeyCreated struct {
	Passkey struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"passkey"`
	RecoveryCodes []string `json:"recovery_codes"`
}

func TestPasskeyRegistration(t *testing.T) {
	t.Parallel()

	h := apitest.New(t)
	first := newSoftKey([]byte{1, 2, 3, 4})
	second := newSoftKey([]byte{5, 6, 7, 8})

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/me/passkeys/options", nil),
		http.StatusUnprocessableEntity, "passkey_invalid", "")

	options := passkeyOptionsOf(t, h)

	if len(decodeB64(t, options.Challenge)) != 32 || len(decodeB64(t, options.UserID)) != 16 ||
		options.UserName != "owner@example.com" || options.ExcludeCredentials == nil || len(options.ExcludeCredentials) != 0 {
		t.Fatalf("options = %+v", options)
	}

	wrong := first.registration("Laptop", bytes.Repeat([]byte{9}, 32), h.URL())
	h.ExpectProblem(postWithOrigin(t, h, "/api/v1/me/passkeys", wrong),
		http.StatusUnprocessableEntity, "passkey_invalid", "")

	valid := first.registration("Laptop", decodeB64(t, options.Challenge), h.URL())
	h.ExpectProblem(postWithOrigin(t, h, "/api/v1/me/passkeys", valid),
		http.StatusUnprocessableEntity, "passkey_invalid", "")

	created := registerPasskey(t, h, first)
	if created.Passkey.Name != "Laptop" || len(created.RecoveryCodes) != 10 {
		t.Fatalf("created = %+v", created)
	}

	options = passkeyOptionsOf(t, h)
	if want := []string{b64(first.credentialID)}; !slices.Equal(options.ExcludeCredentials, want) {
		t.Fatalf("exclude_credentials = %v; want %v", options.ExcludeCredentials, want)
	}

	duplicate := first.registration("Again", decodeB64(t, options.Challenge), h.URL())
	h.ExpectProblem(postWithOrigin(t, h, "/api/v1/me/passkeys", duplicate),
		http.StatusUnprocessableEntity, "passkey_invalid", "")

	other := registerPasskey(t, h, second)
	if len(other.RecoveryCodes) != 0 {
		t.Fatalf("second key recovery codes = %v; want none", other.RecoveryCodes)
	}

	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/me/passkeys/"+uuid.NewString()+"/remove",
		map[string]string{"password": apitest.Password}), http.StatusNotFound, "passkey_not_found", "")
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/me/passkeys/"+created.Passkey.ID+"/remove",
		map[string]string{"password": wrongPassword}), http.StatusForbidden, "password_invalid", "")

	for _, id := range []string{created.Passkey.ID, other.Passkey.ID} {
		h.MustDo(http.MethodPost, "/api/v1/me/passkeys/"+id+"/remove",
			map[string]string{"password": apitest.Password}, http.StatusNoContent, nil)
	}

	expectEmptySecondFactor(t, h)
}

func TestPasskeyChallengeExpires(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC)

	var now atomic.Int64

	now.Store(start.UnixNano())

	h := apitest.New(t, apitest.IdentityClock(func() time.Time { return time.Unix(0, now.Load()).UTC() }))
	key := newSoftKey([]byte{1, 2, 3, 4})
	options := passkeyOptionsOf(t, h)

	now.Store(start.Add(5*time.Minute + time.Second).UnixNano())

	h.ExpectProblem(postWithOrigin(t, h, "/api/v1/me/passkeys", key.registration("Laptop", decodeB64(t, options.Challenge), h.URL())),
		http.StatusUnprocessableEntity, "passkey_invalid", "")
}

func passkeyOptionsOf(t *testing.T, h *apitest.Harness) passkeyOptions {
	t.Helper()

	r := postWithOrigin(t, h, "/api/v1/me/passkeys/options", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("options status = %d: %s", r.Status, r.Body)
	}

	var options passkeyOptions

	r.Decode(t, &options)

	return options
}

func registerPasskey(t *testing.T, h *apitest.Harness, key softKey) passkeyCreated {
	t.Helper()

	options := passkeyOptionsOf(t, h)
	r := postWithOrigin(t, h, "/api/v1/me/passkeys", key.registration("Laptop", decodeB64(t, options.Challenge), h.URL()))

	if r.Status != http.StatusCreated {
		t.Fatalf("createPasskey status = %d: %s", r.Status, r.Body)
	}

	var created passkeyCreated

	r.Decode(t, &created)

	return created
}

func postWithOrigin(t *testing.T, h *apitest.Harness, path string, body any) apitest.Response {
	t.Helper()

	var reader bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&reader).Encode(body); err != nil {
			t.Fatal(err)
		}
	}

	req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, h.URL()+path, &reader)
	if err != nil {
		t.Fatal(err)
	}

	req.Header.Set("Origin", h.URL())
	req.Header.Set("Content-Type", "application/json")

	return h.Send(h.Client, req)
}

func b64(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

func decodeB64(t *testing.T, s string) []byte {
	t.Helper()

	b, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		t.Fatal(err)
	}

	return b
}

// softKey is a software ES256 authenticator.
type softKey struct {
	private      *ecdsa.PrivateKey
	credentialID []byte
}

func newSoftKey(credentialID []byte) softKey {
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		panic(err)
	}

	return softKey{private: private, credentialID: credentialID}
}

// registration builds the body of createPasskey for the host of origin.
func (k softKey) registration(name string, challenge []byte, origin string) map[string]any {
	spki, err := x509.MarshalPKIXPublicKey(&k.private.PublicKey)
	if err != nil {
		panic(err)
	}

	return map[string]any{
		"name":               name,
		"client_data_json":   b64(k.clientData("webauthn.create", challenge, origin)),
		"authenticator_data": b64(k.registrationData("127.0.0.1", 0x41)),
		"public_key":         b64(spki),
		"algorithm":          -7,
	}
}

func (k softKey) clientData(typ string, challenge []byte, origin string) []byte {
	b, _ := json.Marshal(map[string]string{"type": typ, "challenge": b64(challenge), "origin": origin})

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
	digest := sha256.Sum256(append(slices.Clone(authData), clientHash[:]...))

	sig, err := ecdsa.SignASN1(rand.Reader, k.private, digest[:])
	if err != nil {
		panic(err)
	}

	return sig
}
