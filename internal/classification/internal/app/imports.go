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
		subjects[i] = lineSubject(l, accounts, originImport)
		subjects[i].SourceCategory = sources[i]
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

// ManualLine is a line the owner writes. NamedPayee is the payee whose name equals the
// description; it is the line's payee when no alias resolves one (capture A113).
type ManualLine struct {
	ImportLine
	NamedPayee uuid.UUID
}

// DecideManual decides lines the owner writes, before the ledger records them (capture
// A113). It writes nothing.
func (s *Service) DecideManual(ctx context.Context, userID int64, lines []ManualLine) ([]domain.Decision, error) {
	if len(lines) == 0 {
		return nil, nil
	}
	c, accounts, err := s.catalog(ctx, userID)
	if err != nil {
		return nil, err
	}
	subjects := make([]domain.Subject, len(lines))
	for i, l := range lines {
		subjects[i] = lineSubject(l.ImportLine, accounts, originManual)
		if _, aliased := domain.ResolvePayee(l.Description, c.Aliases); !aliased {
			subjects[i].PayeeID = l.NamedPayee
		}
	}
	return s.decideAll(ctx, userID, c, subjects)
}

func lineSubject(l ImportLine, accounts map[uuid.UUID]Account, origin string) domain.Subject {
	class := "income"
	if l.Amount.IsNegative() {
		class = "expense"
	}
	return domain.Subject{
		Date: l.Date, Description: l.Description, RawDescription: l.Description, Amount: l.Amount,
		Accounts: []uuid.UUID{l.AccountID}, AccountKinds: []string{accounts[l.AccountID].Kind}, Source: origin, Class: class,
	}
}
