package tool

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"slices"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/auth"
)

// Preview validates the arguments like Call and returns what the tool would change.
func (r *Registry) Preview(
	ctx context.Context,
	name string,
	args json.RawMessage,
) (Preview, Result, error) {
	e, ok := r.entries[name]
	if !ok {
		return Preview{}, Result{}, fmt.Errorf("preview tool %s: %w", name, ErrUnknownTool)
	}

	booksID, ok := auth.BooksID(ctx)
	if !ok {
		return Preview{}, Result{}, fmt.Errorf("preview tool %s: %w", name, ErrNoBooks)
	}

	if !e.tool.HasPreview() {
		return Preview{}, Result{}, fmt.Errorf("preview tool %s: %w", name, ErrNoPreview)
	}

	start := time.Now()

	p, res, outcome, err := r.preview(ctx, e, booksID, args)
	if err != nil {
		outcome = "canceled"
	}

	r.log.LogAttrs(ctx, slog.LevelInfo, "tool preview",
		slog.String("tool", name),
		slog.Int64("books_id", booksID),
		slog.String("effect", e.tool.spec.Effect.String()),
		slog.String("outcome", outcome),
		slog.Duration("duration", time.Since(start)),
		slog.Int("bytes", len(res.Content)))

	return p, res, err
}

func (r *Registry) preview(
	ctx context.Context,
	e entry,
	booksID int64,
	args json.RawMessage,
) (Preview, Result, string, error) {
	name := e.tool.spec.Name

	if denied := roleDenied(ctx, e.tool.spec); denied != nil {
		res, outcome, err := failure(*denied)
		return Preview{}, res, outcome, err
	}

	args, bad := e.tool.validate(args)
	if bad != nil {
		res, outcome, err := failure(*bad)
		return Preview{}, res, outcome, err
	}

	p, err := e.tool.preview(ctx, booksID, args)
	if err != nil {
		res, outcome, err := r.mapError(ctx, e, err)
		return Preview{}, res, outcome, err
	}

	for _, c := range p.Changes {
		if !slices.Contains(ChangeFields, c.Field) {
			res, outcome, err := r.internal(
				ctx,
				name,
				fmt.Errorf("preview field %q is not in ChangeFields", c.Field),
			)

			return Preview{}, res, outcome, err
		}
	}

	return p, Result{}, "ok", nil
}
