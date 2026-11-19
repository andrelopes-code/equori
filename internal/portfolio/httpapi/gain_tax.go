package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/portfolio/domain"
)

func (s *Server) listGainTax(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (GainTaxMonthList, error) {
	params, err := httpserver.Query[ListGainTaxParams](r)
	if err != nil {
		return GainTaxMonthList{}, err
	}

	booksID := auth.MustBooksID(ctx)

	from, to, err := s.svc.TaxYear(ctx, booksID, params.Year)
	if err != nil {
		return GainTaxMonthList{}, err
	}

	months, base, err := s.svc.GainTax(ctx, booksID, params.Year)
	if err != nil {
		return GainTaxMonthList{}, err
	}

	items := make([]GainTaxMonth, len(months))
	for i, m := range months {
		items[i] = gainTaxMonth(m, string(base))
	}

	return GainTaxMonthList{From: date(from), To: date(to.AddDate(0, 0, -1)), Items: items}, nil
}

func gainTaxMonth(m domain.TaxMonth, currency string) GainTaxMonth {
	cents := func(amount int64) Money { return Money{Amount: amount, Currency: currency} }

	lines := make([]GainTaxLine, len(m.Lines))
	for i, l := range m.Lines {
		lines[i] = GainTaxLine{
			Pool:        l.Pool,
			Gross:       cents(l.Gross),
			Result:      cents(l.Result),
			Exempt:      cents(l.Exempt),
			LossUsed:    cents(l.LossUsed),
			LossCarried: cents(l.LossCarried),
			Base:        cents(l.Base),
			RateBp:      l.RateBP,
			Tax:         cents(l.Tax),
			Withheld:    cents(l.Withheld),
			Due:         cents(l.Due),
		}
	}

	return GainTaxMonth{
		Month:           m.Month.Format("2006-01"),
		Lines:           lines,
		CarriedIn:       cents(m.CarriedIn),
		Darf:            cents(m.Darf),
		CryptoCarriedIn: cents(m.CryptoCarriedIn),
		CryptoDarf:      cents(m.CryptoDarf),
	}
}
