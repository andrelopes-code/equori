package toolapi

import (
	"context"
	"strconv"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/marketdata/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/money"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// ConversationFile reads the content of a file the member attached to the conversation; false
// when the member has no such file (assistant parity design, F7).
type ConversationFile func(
	ctx context.Context,
	booksID, memberID int64,
	id uuid.UUID,
) (name string, content []byte, found bool, err error)

type importPriceFileIn struct {
	FileID string `json:"file_id" jsonschema:"id of a csv file the user attached, from the [file ...] line of the message"`
}

type importPriceFileOut struct {
	Recorded int `json:"recorded"`
}

func importPriceFile(svc Service, files ConversationFile) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "import_price_file",
		Description: "Proposes recording the prices of an attached csv file, all or nothing, as source csv. " +
			"Use it when the user attaches a price file. " +
			"Do not use it for a few typed prices: record_price_series does. The user confirms first.",
		Effect: tool.Write,
		Role:   auth.RoleWrite,
	}, func(ctx context.Context, booksID int64, in importPriceFileIn) (tool.Preview, error) {
		name, content, err := priceFile(ctx, booksID, files, in)
		if err != nil {
			return tool.Preview{}, err
		}

		prices, err := domain.ParsePriceCSV(content)
		if err != nil {
			return tool.Preview{}, err
		}

		changes := []tool.Change{
			{Field: "source", After: tool.TextValue(name)},
			{Field: "count", After: tool.TextValue(strconv.Itoa(len(prices)))},
		}

		return tool.Preview{
			Action:  "import_price_file",
			Changes: append(changes, priceSpan(prices)...),
		}, nil
	}, func(ctx context.Context, booksID int64, in importPriceFileIn) (importPriceFileOut, error) {
		_, content, err := priceFile(ctx, booksID, files, in)
		if err != nil {
			return importPriceFileOut{}, err
		}

		n, err := svc.ImportPrices(ctx, booksID, content)

		return importPriceFileOut{Recorded: n}, err
	})
}

func priceFile(
	ctx context.Context,
	booksID int64,
	files ConversationFile,
	in importPriceFileIn,
) (string, []byte, error) {
	id, err := uuid.Parse(in.FileID)
	if err != nil {
		return "", nil, tool.InvalidArgument("file_id", "is not a UUID")
	}

	name, content, found, err := files(ctx, booksID, auth.MustMemberID(ctx), id)
	if err != nil {
		return "", nil, err
	}

	if !found {
		return "", nil, tool.InvalidArgument("file_id", "is not a file of this conversation")
	}

	return name, content, nil
}

// priceSpan is how many instruments a price file prices and the first and last day it covers
// (F8).
func priceSpan(prices []domain.Price) []tool.Change {
	if len(prices) == 0 {
		return nil
	}

	instruments := map[money.Currency]bool{}
	first, last := prices[0].Date, prices[0].Date

	for _, p := range prices {
		instruments[p.Instrument] = true

		if p.Date.Before(first) {
			first = p.Date
		}

		if p.Date.After(last) {
			last = p.Date
		}
	}

	return []tool.Change{
		{Field: "instruments", After: tool.TextValue(strconv.Itoa(len(instruments)))},
		{Field: "from", After: tool.DateValue(first)},
		{Field: "until", After: tool.DateValue(last)},
	}
}
