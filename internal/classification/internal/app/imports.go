package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

// ImportLine is a statement line before the ledger records it.
type ImportLine struct {
	AccountID   uuid.UUID
	Date        time.Time
	Amount      money.Money
	Description string
	// SourceCategory is the aggregator's category of the line, nil for files (P6 A41).
	SourceCategory *LineCategory
}

// DecideImport decides each line before it is recorded (P5 amendment A19); the decision of
// a line without payee, tags or category is nil.
func (s *Service) DecideImport(ctx context.Context, userID int64, lines []ImportLine) ([]*domain.Decision, error) {
	if len(lines) == 0 {
		return nil, nil
	}
	c, accounts, err := s.catalog(ctx, userID)
	if err != nil {
		return nil, err
	}
	sources, err := s.sourceCategories(ctx, userID, lines)
	if err != nil {
		return nil, err
	}
	subjects := make([]domain.Subject, len(lines))
	for i, l := range lines {
		class := "income"
		if l.Amount.IsNegative() {
			class = "expense"
		}
		subjects[i] = domain.Subject{
			Date: l.Date, Description: l.Description, RawDescription: l.Description, Amount: l.Amount,
			Accounts: []uuid.UUID{l.AccountID}, AccountKinds: []string{accounts[l.AccountID].Kind}, Source: originImport, Class: class,
			SourceCategory: sources[i],
		}
	}
	decisions, err := s.decideAll(ctx, userID, c, subjects)
	if err != nil {
		return nil, err
	}
	out := make([]*domain.Decision, len(decisions))
	for i := range decisions {
		if d := decisions[i]; d.Method != "" || d.PayeeID != uuid.Nil || len(d.AddTags) > 0 {
			out[i] = &decisions[i]
		}
	}
	return out, nil
}
