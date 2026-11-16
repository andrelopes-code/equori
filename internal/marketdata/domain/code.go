package domain

import (
	"crypto/sha256"
	"encoding/binary"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

const crockfordAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// OwnCode is the code of a book-owned contract: RF.<YYMMDD of maturesOn>.<5 characters>, the
// characters the first 25 bits of SHA-256 of the 16 bytes of applicationID in Crockford base32
// (A236 FC2).
func OwnCode(maturesOn time.Time, applicationID uuid.UUID) money.Currency {
	sum := sha256.Sum256(applicationID[:])
	bits := binary.BigEndian.Uint32(sum[:4]) >> 7

	suffix := make([]byte, 5)
	for i := range suffix {
		suffix[i] = crockfordAlphabet[bits>>(5*(4-i))&31]
	}

	return money.Currency("RF." + maturesOn.Format("060102") + "." + string(suffix))
}
