package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/portfolio/app"
)

type netWorthDayView struct {
	Date        tool.Date  `json:"date"`
	Assets      tool.Money `json:"assets"`
	Liabilities tool.Money `json:"liabilities"`
	Net         tool.Money `json:"net"`
}

func netWorthDays(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in getPortfolioIn,
) (getPortfolioOut, error) {
	days, err := svc.NetWorthDays(ctx, booksID, in.From.Time, in.To.Time, "")
	if err != nil {
		return getPortfolioOut{}, err
	}

	out := getPortfolioOut{Days: make([]netWorthDayView, len(days))}
	for i, d := range days {
		out.Days[i] = netWorthDayView{
			Date:        tool.DateOf(d.Date),
			Assets:      tool.MoneyOf(d.Assets),
			Liabilities: tool.MoneyOf(d.Liabilities),
			Net:         tool.MoneyOf(d.Net),
		}
	}

	return out, nil
}
