package toolapi

import (
	"context"
	"strconv"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type importInvestmentFileIn struct {
	FileID        string `json:"file_id"                   jsonschema:"id of the [file ...] line"`
	BrokerageID   string `json:"brokerage_id"              jsonschema:"brokerage"`
	CashAccountID string `json:"cash_account_id,omitempty" jsonschema:"paying account"`
	CategoryID    string `json:"category_id,omitempty"     jsonschema:"income category"`
}

type importInvestmentFileOut struct {
	Lines   int `json:"lines"`
	Created int `json:"created"`
	Skipped int `json:"skipped"`
}

func importInvestmentFile(svc *app.Service, files ConversationFile) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "import_investment_file",
		Description: "Proposes recording an attached csv of openings, trades and incomes in one brokerage, " +
			"all or nothing. Use it for such a file. Do not use it for one operation. The user confirms first.",
		Effect: tool.Write,
		Role:   auth.RoleWrite,
	}, func(ctx context.Context, booksID int64, in importInvestmentFileIn) (tool.Preview, error) {
		name, brokerage, res, err := runInvestmentFile(ctx, svc, files, booksID, in, true)
		if err != nil {
			return tool.Preview{}, err
		}

		return tool.Preview{Action: "import_investment_file", Changes: []tool.Change{
			{Field: "file", After: tool.TextValue(name)},
			{Field: "brokerage", After: tool.TextValue(brokerage)},
			{Field: "lines", After: tool.TextValue(strconv.Itoa(res.Lines))},
			{Field: "created", After: tool.TextValue(strconv.Itoa(res.Created))},
			{Field: "skipped", After: tool.TextValue(strconv.Itoa(res.Skipped))},
		}}, nil
	}, func(ctx context.Context, booksID int64, in importInvestmentFileIn) (importInvestmentFileOut, error) {
		_, _, res, err := runInvestmentFile(ctx, svc, files, booksID, in, false)

		return importInvestmentFileOut{
			Lines: res.Lines, Created: res.Created, Skipped: res.Skipped,
		}, err
	})
}

// runInvestmentFile reads the attached file and imports it, as a dry run for the preview.
func runInvestmentFile(
	ctx context.Context,
	svc *app.Service,
	files ConversationFile,
	booksID int64,
	in importInvestmentFileIn,
	dryRun bool,
) (name, brokerage string, res app.InvestmentFileResult, err error) {
	fileID, err := uuid.Parse(in.FileID)
	if err != nil {
		return "", "", res, tool.InvalidArgument("file_id", "is not a UUID")
	}

	f := app.InvestmentFile{DryRun: dryRun}

	if f.BrokerageID, err = uuid.Parse(in.BrokerageID); err != nil {
		return "", "", res, tool.InvalidArgument("brokerage_id", "is not a UUID")
	}

	if f.CashAccountID, err = optionalID(in.CashAccountID, "cash_account_id"); err != nil {
		return "", "", res, err
	}

	if f.CategoryID, err = optionalID(in.CategoryID, "category_id"); err != nil {
		return "", "", res, err
	}

	name, content, found, err := files(ctx, booksID, auth.MustMemberID(ctx), fileID)
	if err != nil {
		return "", "", res, err
	}

	if !found {
		return "", "", res, tool.InvalidArgument("file_id", "is not a file of this conversation")
	}

	f.Content = content

	acct, err := svc.Account(ctx, booksID, f.BrokerageID)
	if err != nil {
		return "", "", res, err
	}

	res, err = svc.ImportInvestmentFile(ctx, booksID, f)

	return name, acct.Name, res, err
}
