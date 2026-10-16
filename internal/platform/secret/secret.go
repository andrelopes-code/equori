// Package secret seals integration credentials with AES-256-GCM (ADR 008).
package secret

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
)

const (
	KeySize     = 32
	formatV1    = 1
	keyIDSize   = 4
	headerSize  = 1 + keyIDSize
	nonceSize   = 12
	minimumSize = headerSize + nonceSize + 16
)

// ErrUnreadable covers a wrong key, a tampered value and other associated data alike, so
// the caller learns nothing about which one failed.
var ErrUnreadable = errors.New("sealed value cannot be opened")

type key struct {
	id   []byte
	aead cipher.AEAD
}

// Box seals with the current key and opens values sealed with the current or previous key.
type Box struct {
	current  key
	previous *key
}

func New(current, previous []byte) (*Box, error) {
	cur, err := newKey(current)
	if err != nil {
		return nil, fmt.Errorf("current key: %w", err)
	}
	b := &Box{current: cur}
	if previous != nil {
		prev, err := newKey(previous)
		if err != nil {
			return nil, fmt.Errorf("previous key: %w", err)
		}
		if bytes.Equal(prev.id, cur.id) {
			return nil, errors.New("previous key equals the current key")
		}
		b.previous = &prev
	}
	return b, nil
}

func newKey(k []byte) (key, error) {
	if len(k) != KeySize {
		return key{}, fmt.Errorf("must be %d bytes, got %d", KeySize, len(k))
	}
	block, err := aes.NewCipher(k)
	if err != nil {
		return key{}, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return key{}, err
	}
	sum := sha256.Sum256(k)
	return key{id: sum[:keyIDSize], aead: aead}, nil
}

// Seal returns format byte | key id | nonce | ciphertext and tag. associated binds the
// value to its row: the same bytes under another row do not open.
func (b *Box) Seal(plaintext, associated []byte) ([]byte, error) {
	out := make([]byte, headerSize+nonceSize, headerSize+nonceSize+len(plaintext)+b.current.aead.Overhead())
	out[0] = formatV1
	copy(out[1:headerSize], b.current.id)
	if _, err := rand.Read(out[headerSize:]); err != nil {
		return nil, fmt.Errorf("nonce: %w", err)
	}
	return b.current.aead.Seal(out, out[headerSize:], plaintext, b.associated(associated, out[:headerSize])), nil
}

func (b *Box) Open(sealed, associated []byte) ([]byte, error) {
	if len(sealed) < minimumSize || sealed[0] != formatV1 {
		return nil, ErrUnreadable
	}
	k, ok := b.keyFor(sealed[1:headerSize])
	if !ok {
		return nil, ErrUnreadable
	}
	nonce := sealed[headerSize : headerSize+nonceSize]
	plaintext, err := k.aead.Open(nil, nonce, sealed[headerSize+nonceSize:], b.associated(associated, sealed[:headerSize]))
	if err != nil {
		return nil, ErrUnreadable
	}
	return plaintext, nil
}

// NeedsReseal reports a value sealed with a key other than the current one.
func (b *Box) NeedsReseal(sealed []byte) bool {
	return len(sealed) < headerSize || !bytes.Equal(sealed[1:headerSize], b.current.id)
}

func (b *Box) keyFor(id []byte) (key, bool) {
	switch {
	case bytes.Equal(id, b.current.id):
		return b.current, true
	case b.previous != nil && bytes.Equal(id, b.previous.id):
		return *b.previous, true
	}
	return key{}, false
}

// associated also covers the header, so a value cannot be relabelled with another key id.
func (b *Box) associated(row, header []byte) []byte {
	return append(bytes.Clone(header), row...)
}
