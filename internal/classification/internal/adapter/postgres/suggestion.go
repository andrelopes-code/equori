package postgres

import (
	"context"
	"encoding/json/v2"
	"fmt"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/classification/internal/app"
	"github.com/andrelopes-code/equori/internal/classification/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/page"
)

func toSuggestion(row ClassificationSuggestion) (app.Suggestion, error) {
	var conditions []domain.ConditionDoc
	var actions []domain.ActionDoc
	if err := json.Unmarshal(row.Conditions, &conditions); err != nil {
		return app.Suggestion{}, fmt.Errorf("decode suggestion %s conditions: %w", row.ID, err)
	}
	if err := json.Unmarshal(row.Actions, &actions); err != nil {
		return app.Suggestion{}, fmt.Errorf("decode suggestion %s actions: %w", row.ID, err)
	}
	rule, err := domain.RuleFromDocs(domain.Rule{Name: "suggestion"}, conditions, actions)
	if err != nil {
		return app.Suggestion{}, fmt.Errorf("stored suggestion %s: %w", row.ID, err)
	}
	return app.Suggestion{
		ID: row.ID, UserID: row.UserID, Fingerprint: row.Fingerprint, Conditions: rule.Conditions, Actions: rule.Actions,
		Examples: row.ExampleTransactionIds, State: row.State, RuleID: row.RuleID.UUID, CreatedAt: row.CreatedAt, DecidedAt: row.DecidedAt,
	}, nil
}

func (r *Repository) CorrectedExamples(ctx context.Context, userID int64, matchKey string, categoryID uuid.UUID, limit int) ([]uuid.UUID, error) {
	return r.q.CorrectedExamples(ctx, CorrectedExamplesParams{
		UserID: userID, MatchKey: &matchKey, CategoryID: nullUUID(categoryID), RowLimit: int32(limit), //nolint:gosec // a small fixed limit
	})
}

func (r *Repository) UpsertSuggestion(ctx context.Context, s app.Suggestion) error {
	rule := domain.Rule{Conditions: s.Conditions, Actions: s.Actions}
	conditions, actions, err := ruleDocs(rule)
	if err != nil {
		return err
	}
	return r.q.UpsertSuggestion(ctx, UpsertSuggestionParams{
		UserID: s.UserID, Fingerprint: s.Fingerprint, Conditions: conditions, Actions: actions,
		ExampleTransactionIds: s.Examples, CreatedAt: s.CreatedAt,
	})
}

func (r *Repository) ListSuggestions(ctx context.Context, userID int64, state string, p page.Request[app.SuggestionKey]) ([]app.Suggestion, *app.SuggestionKey, error) {
	params := ListSuggestionsParams{UserID: userID, State: nullString(state), RowLimit: int32(p.Limit + 1)} //nolint:gosec // limit is at most page.MaxLimit
	if p.After != nil {
		params.AfterID = nullUUID(p.After.ID)
	}
	rows, err := r.q.ListSuggestions(ctx, params)
	if err != nil {
		return nil, nil, err
	}
	kept, more := page.Trim(rows, p.Limit)
	out := make([]app.Suggestion, len(kept))
	for i, row := range kept {
		if out[i], err = toSuggestion(row); err != nil {
			return nil, nil, err
		}
	}
	if !more {
		return out, nil, nil
	}
	return out, &app.SuggestionKey{ID: kept[len(kept)-1].ID}, nil
}

func (r *Repository) LockSuggestion(ctx context.Context, userID int64, id uuid.UUID) (app.Suggestion, error) {
	row, err := r.q.LockSuggestion(ctx, LockSuggestionParams{UserID: userID, ID: id})
	if err != nil {
		return app.Suggestion{}, notFound(err)
	}
	return toSuggestion(row)
}

func (r *Repository) DecideSuggestion(ctx context.Context, userID int64, id uuid.UUID, state string, ruleID uuid.UUID) (app.Suggestion, error) {
	row, err := r.q.DecideSuggestion(ctx, DecideSuggestionParams{UserID: userID, ID: id, State: state, RuleID: nullUUID(ruleID)})
	if err != nil {
		return app.Suggestion{}, notFound(err)
	}
	return toSuggestion(row)
}
