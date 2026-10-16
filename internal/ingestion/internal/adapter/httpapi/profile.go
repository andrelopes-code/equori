package httpapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
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
		DateColumn: p.DateColumn, DateLayout: CsvProfileDateLayout(p.DateLayout), DecimalSeparator: CsvProfileDecimalSeparator(p.DecimalSeparator),
		DescriptionColumn: p.DescriptionColumn, HeaderRows: &p.HeaderRows, AmountColumn: ref(p.AmountColumn),
		DebitColumn: ref(p.DebitColumn), CreditColumn: ref(p.CreditColumn), IdColumn: ref(p.IDColumn),
	}
	for name, c := range delimiters {
		if c == p.Delimiter {
			out.Delimiter = &name
		}
	}
	sign := CsvProfileAmountSign(p.AmountSign)
	out.AmountSign = &sign
	return out
}

func (s *Server) GetCsvProfile(ctx context.Context, req GetCsvProfileRequestObject) (GetCsvProfileResponseObject, error) {
	p, err := s.svc.Profile(ctx, auth.MustUserID(ctx), req.Id)
	if err != nil {
		return nil, err
	}
	return GetCsvProfile200JSONResponse(toProfileAPI(p)), nil
}

func (s *Server) SaveCsvProfile(ctx context.Context, req SaveCsvProfileRequestObject) (SaveCsvProfileResponseObject, error) {
	b := req.Body
	p := domain.Profile{
		UserID: auth.MustUserID(ctx), AccountID: req.Id, HeaderRows: 1, DateColumn: b.DateColumn, DateLayout: domain.DateLayout(b.DateLayout),
		AmountColumn: opt(b.AmountColumn), DebitColumn: opt(b.DebitColumn), CreditColumn: opt(b.CreditColumn),
		DecimalSeparator: string(b.DecimalSeparator), DescriptionColumn: b.DescriptionColumn, IDColumn: opt(b.IdColumn),
	}
	if b.Delimiter != nil {
		p.Delimiter = delimiters[*b.Delimiter]
	}
	if b.HeaderRows != nil {
		p.HeaderRows = *b.HeaderRows
	}
	if b.AmountSign != nil {
		p.AmountSign = domain.AmountSign(*b.AmountSign)
	}
	saved, err := s.svc.SaveProfile(ctx, p)
	if err != nil {
		return nil, err
	}
	return SaveCsvProfile200JSONResponse(toProfileAPI(saved)), nil
}
