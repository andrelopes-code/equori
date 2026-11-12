package classification

import (
	"context"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/app"
	"github.com/andrelopes-code/equori/internal/classification/domain"
	"github.com/andrelopes-code/equori/internal/ledger"
)

// DecideImport decides payee, tags and category of each line before the ledger records it
// (P5 amendment A19); the decision of a line with nothing to set is nil.
func (m *Module) DecideImport(
	ctx context.Context,
	booksID int64,
	lines []ImportLine,
) ([]*ledger.ImportDecision, error) {
	decisions, err := m.svc.DecideImport(ctx, booksID, lines)
	if err != nil {
		return nil, err
	}

	out := make([]*ledger.ImportDecision, len(decisions))
	for i, d := range decisions {
		if d != nil {
			out[i] = importDecision(*d)
		}
	}

	return out, nil
}

// importDecisions keeps nil for a decision without payee, tags or category.
func importDecisions(ds []domain.Decision) []*ledger.ImportDecision {
	out := make([]*ledger.ImportDecision, len(ds))
	for i, d := range ds {
		if d.Method != "" || d.PayeeID != uuid.Nil || len(d.AddTags) > 0 {
			out[i] = importDecision(d)
		}
	}

	return out
}

func importDecision(d domain.Decision) *ledger.ImportDecision {
	out := &ledger.ImportDecision{
		PayeeID:    d.PayeeID,
		AddTags:    d.AddTags,
		TransferTo: d.TransferTo,
		Cause:      ledger.Cause{Method: d.Method, RuleID: d.RuleID},
	}
	for _, a := range d.Parts {
		out.Parts = append(
			out.Parts,
			ledger.CategoryPart{AccountID: a.CategoryID, Amount: a.Amount},
		)
	}

	return out
}

// DecideManual decides payee, tags and category of each line with the precedence of F5 for
// origin manual (capture A113); the decision of a line with nothing to set is nil.
func (m *Module) DecideManual(
	ctx context.Context,
	booksID int64,
	lines []ManualLine,
) ([]*ledger.ImportDecision, error) {
	in := make([]app.ManualLine, len(lines))
	for i, l := range lines {
		in[i] = app.ManualLine{
			ImportLine: app.ImportLine{
				AccountID:   l.AccountID,
				Date:        l.Date,
				Amount:      l.Amount,
				Description: l.Description,
			},
			NamedPayee: l.NamedPayee,
		}
	}

	decisions, err := m.svc.DecideManual(ctx, booksID, in)
	if err != nil {
		return nil, err
	}

	return importDecisions(decisions), nil
}
