package domain

import (
	"bytes"
	"crypto"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/x509"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
)

const (
	AlgES256 = -7
	AlgEdDSA = -8
	AlgRS256 = -257

	flagUserPresent  = 0x01
	flagAttestedData = 0x40

	// authDataHeader is the RP ID hash, the flags and the counter.
	authDataHeader = 37
	// attestedHeader is the AAGUID and the credential ID length that follow the header.
	attestedHeader = 18
	// maxCredentialIDLength is the limit of WebAuthn level 2, section 6.5.1.
	maxCredentialIDLength = 1023

	minRSABits = 2048
)

var ErrWebAuthn = errors.New("webauthn check failed") // every check below wraps it

// Registration is the credential read from a creation ceremony.
type Registration struct {
	CredentialID []byte
	PublicKey    []byte // the SPKI DER as received
	Algorithm    int
	SignCount    uint32
}

type clientData struct {
	Type      string `json:"type"`
	Challenge string `json:"challenge"`
	Origin    string `json:"origin"`
}

// RPID returns the host name of an http or https origin.
func RPID(origin string) (string, bool) {
	u, err := url.Parse(origin)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" {
		return "", false
	}

	return u.Hostname(), true
}

// VerifyRegistration checks a creation ceremony (HA41).
func VerifyRegistration(clientDataJSON, authData, publicKey []byte, algorithm int, challenge []byte, origin string) (Registration, error) {
	counter, err := checkCeremony("webauthn.create", clientDataJSON, authData, challenge, origin)
	if err != nil {
		return Registration{}, err
	}

	if authData[32]&flagAttestedData == 0 {
		return Registration{}, fmt.Errorf("%w: no attested credential data", ErrWebAuthn)
	}

	id, err := credentialID(authData)
	if err != nil {
		return Registration{}, err
	}

	if _, err := parseKey(publicKey, algorithm); err != nil {
		return Registration{}, err
	}

	return Registration{CredentialID: id, PublicKey: publicKey, Algorithm: algorithm, SignCount: counter}, nil
}

// VerifyAssertion checks an assertion against a stored key and returns the counter of authData.
func VerifyAssertion(clientDataJSON, authData, signature, publicKey []byte, algorithm int, challenge []byte, origin string) (uint32, error) {
	counter, err := checkCeremony("webauthn.get", clientDataJSON, authData, challenge, origin)
	if err != nil {
		return 0, err
	}

	key, err := parseKey(publicKey, algorithm)
	if err != nil {
		return 0, err
	}

	clientHash := sha256.Sum256(clientDataJSON)
	message := append(bytes.Clone(authData), clientHash[:]...)

	if !verifySignature(key, algorithm, message, signature) {
		return 0, fmt.Errorf("%w: signature", ErrWebAuthn)
	}

	return counter, nil
}

// checkCeremony validates the client data and the fixed part of the authenticator data, and
// returns the counter.
func checkCeremony(typ string, clientDataJSON, authData, challenge []byte, origin string) (uint32, error) {
	rpID, ok := RPID(origin)
	if !ok {
		return 0, fmt.Errorf("%w: origin %q", ErrWebAuthn, origin)
	}

	var cd clientData
	if err := json.Unmarshal(clientDataJSON, &cd); err != nil {
		return 0, fmt.Errorf("%w: client data: %w", ErrWebAuthn, err)
	}

	got, err := base64.RawURLEncoding.DecodeString(cd.Challenge)

	switch {
	case cd.Type != typ:
		return 0, fmt.Errorf("%w: type %q", ErrWebAuthn, cd.Type)
	case err != nil || subtle.ConstantTimeCompare(got, challenge) != 1:
		return 0, fmt.Errorf("%w: challenge", ErrWebAuthn)
	case cd.Origin != origin:
		return 0, fmt.Errorf("%w: origin %q", ErrWebAuthn, cd.Origin)
	case len(authData) < authDataHeader:
		return 0, fmt.Errorf("%w: authenticator data of %d bytes", ErrWebAuthn, len(authData))
	}

	hash := sha256.Sum256([]byte(rpID))
	if !bytes.Equal(authData[:32], hash[:]) {
		return 0, fmt.Errorf("%w: RP ID hash", ErrWebAuthn)
	}

	if authData[32]&flagUserPresent == 0 {
		return 0, fmt.Errorf("%w: user not present", ErrWebAuthn)
	}

	return binary.BigEndian.Uint32(authData[33:authDataHeader]), nil
}

func credentialID(authData []byte) ([]byte, error) {
	if len(authData) < authDataHeader+attestedHeader {
		return nil, fmt.Errorf("%w: attested credential data", ErrWebAuthn)
	}

	length := int(binary.BigEndian.Uint16(authData[authDataHeader+16:]))
	start := authDataHeader + attestedHeader

	if length == 0 || length > maxCredentialIDLength || len(authData) < start+length {
		return nil, fmt.Errorf("%w: credential ID length %d", ErrWebAuthn, length)
	}

	return bytes.Clone(authData[start : start+length]), nil
}

// parseKey parses the SPKI and requires the key type of the algorithm.
func parseKey(spki []byte, algorithm int) (crypto.PublicKey, error) {
	key, err := x509.ParsePKIXPublicKey(spki)
	if err != nil {
		return nil, fmt.Errorf("%w: public key: %w", ErrWebAuthn, err)
	}

	switch k := key.(type) {
	case *ecdsa.PublicKey:
		if algorithm == AlgES256 && k.Curve == elliptic.P256() {
			return k, nil
		}
	case ed25519.PublicKey:
		if algorithm == AlgEdDSA {
			return k, nil
		}
	case *rsa.PublicKey:
		if algorithm == AlgRS256 && k.N.BitLen() >= minRSABits {
			return k, nil
		}
	}

	return nil, fmt.Errorf("%w: public key does not match algorithm %d", ErrWebAuthn, algorithm)
}

func verifySignature(key crypto.PublicKey, algorithm int, message, signature []byte) bool {
	digest := sha256.Sum256(message)

	switch k := key.(type) {
	case *ecdsa.PublicKey:
		return algorithm == AlgES256 && ecdsa.VerifyASN1(k, digest[:], signature)
	case ed25519.PublicKey:
		return algorithm == AlgEdDSA && ed25519.Verify(k, message, signature)
	case *rsa.PublicKey:
		return algorithm == AlgRS256 && rsa.VerifyPKCS1v15(k, crypto.SHA256, digest[:], signature) == nil
	}

	return false
}
