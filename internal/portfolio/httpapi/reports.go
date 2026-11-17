package httpapi

import (
	"context"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

func (s *Server) getAllocation(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (Allocation, error) {
	params, err := httpserver.Query[GetAllocationParams](r)
	if err != nil {
		return Allocation{}, err
	}

	res, err := s.svc.Allocation(
		ctx,
		auth.MustBooksID(ctx),
		params.Date.Time,
		string(params.By),
		valueIn(params.ValueIn),
	)
	if err != nil {
		return Allocation{}, err
	}

	out := Allocation{
		Total:   toMoney(res.Total),
		Groups:  make([]AllocationGroup, len(res.Groups)),
		Current: toCurrent(res.Current),
	}
	for i, g := range res.Groups {
		out.Groups[i] = AllocationGroup{Key: g.Key, Value: toMoney(g.Value), ShareBp: g.ShareBP}
	}

	return out, nil
}

func (s *Server) getNetWorth(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (NetWorth, error) {
	params, err := httpserver.Query[GetNetWorthParams](r)
	if err != nil {
		return NetWorth{}, err
	}

	res, err := s.svc.NetWorth(
		ctx,
		auth.MustBooksID(ctx),
		params.Date.Time,
		valueIn(params.ValueIn),
	)
	if err != nil {
		return NetWorth{}, err
	}

	return NetWorth{
		Assets:      toMoney(res.Assets),
		Liabilities: toMoney(res.Liabilities),
		Net:         toMoney(res.Net),
		Current:     toCurrent(res.Current),
	}, nil
}

func (s *Server) getNetWorthDays(
	ctx context.Context,
	r *http.Request,
	_ httpserver.None,
) (NetWorthDays, error) {
	params, err := httpserver.Query[GetNetWorthDaysParams](r)
	if err != nil {
		return NetWorthDays{}, err
	}

	days, err := s.svc.NetWorthDays(
		ctx,
		auth.MustBooksID(ctx),
		params.From.Time,
		params.To.Time,
		valueIn(params.ValueIn),
	)
	if err != nil {
		return NetWorthDays{}, err
	}

	out := NetWorthDays{Items: make([]NetWorthDay, 0, len(days))}
	for _, d := range days {
		out.Items = append(out.Items, NetWorthDay{
			Date:        date(d.Date),
			Assets:      toMoney(d.Assets),
			Liabilities: toMoney(d.Liabilities),
			Net:         toMoney(d.Net),
			Current:     toCurrent(d.Current),
		})
	}

	return out, nil
}

func toCurrent(c *app.CurrentQuotes) *CurrentQuotes {
	if c == nil {
		return nil
	}

	return &CurrentQuotes{Count: c.Count, Open: c.Open, OldestAt: c.OldestAt.UTC()}
}
