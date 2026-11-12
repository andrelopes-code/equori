package httpapi

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

// delimiters maps the contract's names to the characters CSV files use.
var delimiters = map[CsvProfileDelimiter]string{Comma: ",", Semicolon: ";", Tab: "\t", Pipe: "|"}

func opt(s *string) string {
	if s == nil {
		return ""
	}

	return *s
}

func ref(s string) *string {
	if s == "" {
		return nil
	}

	return &s
}

func toProfileAPI(p domain.Profile) CsvProfile {
	out := CsvProfile{
		DateColumn:        p.DateColumn,
		DateLayout:        string(p.DateLayout),
		DecimalSeparator:  CsvProfileDecimalSeparator(p.DecimalSeparator),
		DescriptionColumn: p.DescriptionColumn,
		HeaderRows:        &p.HeaderRows,
		AmountColumn:      ref(p.AmountColumn),
		DebitColumn: ref(
			p.DebitColumn,
		),
		CreditColumn: ref(p.CreditColumn),
		IdColumn:     ref(p.IDColumn),
	}
	for name, c := range delimiters {
		if c == p.Delimiter {
			out.Delimiter = &name
		}
	}

	sign := CsvProfileAmountSign(p.AmountSign)
	out.AmountSign = &sign
	out.Encoding = &p.Encoding
	out.GroupSeparator = &p.GroupSeparator
	out.FooterRows = &p.FooterRows
	out.SignColumn = ref(p.SignColumn)
	out.DebitMarker = ref(p.DebitMarker)

	return out
}

func (s *Server) getCsvProfile(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (CsvProfile, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return CsvProfile{}, err
	}

	p, err := s.svc.Profile(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return CsvProfile{}, err
	}

	return toProfileAPI(p), nil
}

func (s *Server) saveCsvProfile(
	ctx context.Context, r *http.Request, b SaveCsvProfileJSONRequestBody,
) (CsvProfile, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return CsvProfile{}, err
	}

	p := csvProfile(auth.MustBooksID(ctx), id, b)

	saved, err := s.svc.SaveProfile(ctx, p)
	if err != nil {
		return CsvProfile{}, err
	}

	return toProfileAPI(saved), nil
}

func csvProfile(booksID int64, id uuid.UUID, b SaveCsvProfileJSONRequestBody) domain.Profile {
	p := domain.Profile{
		BooksID:    booksID,
		AccountID:  id,
		HeaderRows: 1,
		DateColumn: b.DateColumn,
		DateLayout: domain.DateLayout(b.DateLayout),
		AmountColumn: opt(
			b.AmountColumn,
		),
		DebitColumn:  opt(b.DebitColumn),
		CreditColumn: opt(b.CreditColumn),
		DecimalSeparator: string(
			b.DecimalSeparator,
		),
		DescriptionColumn: b.DescriptionColumn,
		IDColumn:          opt(b.IdColumn),
	}
	if b.Delimiter != nil {
		p.Delimiter = delimiters[*b.Delimiter]
	}

	if b.HeaderRows != nil {
		p.HeaderRows = *b.HeaderRows
	}

	if b.Encoding != nil {
		p.Encoding = *b.Encoding
	}

	if b.GroupSeparator != nil {
		p.GroupSeparator = *b.GroupSeparator
	} else if p.DecimalSeparator == "," {
		p.GroupSeparator = "."
	} else {
		p.GroupSeparator = ","
	}

	if b.FooterRows != nil {
		p.FooterRows = *b.FooterRows
	}

	p.SignColumn, p.DebitMarker = opt(b.SignColumn), opt(b.DebitMarker)

	if b.AmountSign != nil {
		p.AmountSign = domain.AmountSign(*b.AmountSign)
	}

	return p
}

func (s *Server) suggestCsvColumns(
	ctx context.Context, r *http.Request, in SuggestCsvColumnsJSONRequestBody,
) (CsvColumnSuggestion, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return CsvColumnSuggestion{}, err
	}

	sample := domain.ColumnSample{Rows: in.Rows}
	if in.Header != nil {
		sample.Header = *in.Header
	}

	got, err := s.svc.SuggestColumns(ctx, auth.MustBooksID(ctx), id, sample)
	if err != nil {
		return CsvColumnSuggestion{}, err
	}

	return CsvColumnSuggestion{
		DateColumn:        got.Date,
		DescriptionColumn: got.Description,
		AmountColumn:      ref(got.Amount),
		DebitColumn: ref(
			got.Debit,
		),
		CreditColumn: ref(got.Credit),
		IdColumn:     ref(got.ID),
		SignColumn:   ref(got.Sign),
	}, nil
}
