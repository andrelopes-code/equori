package domain

import (
	"crypto/sha256"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// installmentMark matches what banks append to describe an installment: "03/06", "parc 3/6",
// "parcela 3 de 6".
var installmentMark = regexp.MustCompile(`\b(parc(ela)?\.?\s*)?\d{1,3}\s*(/|de)\s*\d{1,3}\b`)

// PlanKey identifies the installment purchase an aggregator line belongs to (P6 amendment
// A40): card, purchase date, installment count and description without the installment mark.
func PlanKey(accountID uuid.UUID, i Installment, description string) []byte {
	d := NormalizeDescription(installmentMark.ReplaceAllString(strings.ToLower(description), " "))
	sum := sha256.Sum256([]byte(accountID.String() + "\x00" + i.PurchaseDate.Format(time.DateOnly) + "\x00" + strconv.Itoa(i.Count) + "\x00" + d))
	return sum[:]
}
