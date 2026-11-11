package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/andrelopes-code/equori/internal/platform/locale"
)

// UpdateProfile stores the language of the member and the region of the books in one transaction.
func (r *Repository) UpdateProfile(ctx context.Context, memberID, booksID int64, l locale.Locale) error {
	return pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		if err := q.UpdateLanguage(ctx, UpdateLanguageParams{ID: memberID, Language: l.Language}); err != nil {
			return err
		}

		return q.UpdateRegion(ctx, UpdateRegionParams{ID: booksID, Region: l.Region})
	})
}

func (r *Repository) Locale(ctx context.Context, booksID, memberID int64) (locale.Locale, error) {
	row, err := r.q.GetLocale(ctx, GetLocaleParams{BooksID: booksID, MemberID: memberID})
	if err != nil {
		return locale.Locale{}, notFound(err)
	}

	return locale.Locale{Language: row.Language, Region: row.Region}, nil
}

func (r *Repository) Appearance(ctx context.Context, memberID int64) ([]byte, error) {
	doc, err := r.q.GetAppearance(ctx, memberID)
	if err != nil {
		return nil, notFound(err)
	}

	return doc, nil
}

func (r *Repository) SetAppearance(ctx context.Context, memberID int64, doc []byte) error {
	return r.q.SetAppearance(ctx, SetAppearanceParams{ID: memberID, Appearance: doc})
}

// SetDisplayName stores the name; an empty name clears it.
func (r *Repository) SetDisplayName(ctx context.Context, memberID int64, name string) error {
	var stored *string
	if name != "" {
		stored = &name
	}

	return r.q.UpdateDisplayName(ctx, UpdateDisplayNameParams{ID: memberID, DisplayName: stored})
}
