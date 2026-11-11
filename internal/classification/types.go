package classification

import (
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/app"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// MethodRule is the classification method of a rule of the owner.
const MethodRule = app.MethodRule

// ImportLine is a statement line before the ledger records it.
type ImportLine = app.ImportLine

// LineCategory is the aggregator category of an imported line (P6 amendment A41).
type LineCategory = app.LineCategory

// ManualLine is a line the owner writes, before the ledger records it. NamedPayee is the
// payee whose name equals the description, the line's payee when no alias resolves one.
type ManualLine struct {
	AccountID   uuid.UUID
	Date        time.Time
	Amount      money.Money
	Description string
	NamedPayee  uuid.UUID
}
