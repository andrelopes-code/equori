package secret

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
)

const (
	passphraseFormat = 1
	// PassphraseIterations is the PBKDF2-HMAC-SHA256 cost of format 1 (OWASP, 2023).
	PassphraseIterations = 600_000
	saltSize             = 16
	passphraseHeader     = 1 + 4 + saltSize + nonceSize
)

// passphraseContext is the associated data of a value sealed with a passphrase.
var passphraseContext = []byte("equori-credentials-v1")

// SealWithPassphrase returns format byte | iterations (4 bytes, big endian) | salt | nonce |
// ciphertext and tag. It carries a value to another instance, which has another key (export design C3).
func SealWithPassphrase(plaintext []byte, passphrase string) ([]byte, error) {
	out := make([]byte, passphraseHeader)
	out[0] = passphraseFormat
	binary.BigEndian.PutUint32(out[1:5], PassphraseIterations)

	if _, err := rand.Read(out[5:]); err != nil {
		return nil, fmt.Errorf("salt and nonce: %w", err)
	}

	aead, err := passphraseAEAD(passphrase, out[5:5+saltSize])
	if err != nil {
		return nil, err
	}

	return aead.Seal(out, out[5+saltSize:], plaintext, passphraseContext), nil
}

// OpenWithPassphrase reverses SealWithPassphrase. A wrong passphrase, a tampered value and an
// unknown format are the same error, ErrUnreadable.
func OpenWithPassphrase(sealed []byte, passphrase string) ([]byte, error) {
	if len(sealed) < passphraseHeader+16 || sealed[0] != passphraseFormat ||
		binary.BigEndian.Uint32(sealed[1:5]) != PassphraseIterations {
		return nil, ErrUnreadable
	}

	aead, err := passphraseAEAD(passphrase, sealed[5:5+saltSize])
	if err != nil {
		return nil, ErrUnreadable
	}

	plaintext, err := aead.Open(nil, sealed[5+saltSize:passphraseHeader], sealed[passphraseHeader:], passphraseContext)
	if err != nil {
		return nil, ErrUnreadable
	}

	return plaintext, nil
}

func passphraseAEAD(passphrase string, salt []byte) (cipher.AEAD, error) {
	k, err := pbkdf2.Key(sha256.New, passphrase, salt, PassphraseIterations, KeySize)
	if err != nil {
		return nil, fmt.Errorf("derive key: %w", err)
	}

	block, err := aes.NewCipher(k)
	if err != nil {
		return nil, err
	}

	return cipher.NewGCM(block)
}
