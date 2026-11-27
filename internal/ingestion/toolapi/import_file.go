package toolapi

import (
	"bytes"
	"context"
	"encoding/csv"
	"strconv"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/ingestion/ofx"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// StatementFile is a file the member attached to the conversation (assistant parity design, F7).
type StatementFile struct {
	Name, Kind string
	Content    []byte
}

// ConversationFile reads a file of the member by id; false when the member has no such file.
type ConversationFile func(
	ctx context.Context,
	booksID, memberID int64,
	id uuid.UUID,
) (StatementFile, bool, error)

type importStatementFileIn struct {
	FileID    string `json:"file_id"    jsonschema:"id of an ofx or csv file the user attached, from the [file ...] line of the message"`
	AccountID string `json:"account_id" jsonschema:"account the statement belongs to, from list_accounts"`
}

type importStatementFileOut struct {
	BatchID     string `json:"batch_id"`
	Received    int    `json:"received"`
	Created     int    `json:"created"`
	Matched     int    `json:"matched"`
	NeedsReview int    `json:"needs_review"`
	Ignored     int    `json:"ignored"`
}

func importStatementFile(svc *app.Service, names AccountNames, files ConversationFile) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "import_statement_file",
		Description: "Proposes importing an attached ofx or csv statement into one account, as the Import statement " +
			"screen does; a line already imported creates nothing. A csv file needs the CSV profile of the account. " +
			"Use it when the user attaches a statement and asks to import it. " +
			"Do not use it for a PDF or an image: read it and propose record_transaction. The user confirms first.",
		Effect: tool.Write,
		Role:   auth.RoleWrite,
	}, previewStatementFile(names, files), func(ctx context.Context, booksID int64, in importStatementFileIn) (importStatementFileOut, error) {
		f, account, err := statementInput(ctx, booksID, files, in)
		if err != nil {
			return importStatementFileOut{}, err
		}

		b, err := svc.Import(ctx, app.ImportFile{
			BooksID:   booksID,
			AccountID: account,
			Source:    domain.Source(f.Kind),
			FileName:  f.Name,
			Content:   f.Content,
		})
		if err != nil {
			return importStatementFileOut{}, err
		}

		return importStatementFileOut{
			BatchID:     b.ID.String(),
			Received:    b.Counts.Received,
			Created:     b.Counts.Created,
			Matched:     b.Counts.Matched,
			NeedsReview: b.Counts.NeedsReview,
			Ignored:     b.Counts.Ignored,
		}, nil
	})
}

// previewStatementFile names the file, the account and the line count of an import (F8).
func previewStatementFile(
	names AccountNames,
	files ConversationFile,
) func(context.Context, int64, importStatementFileIn) (tool.Preview, error) {
	return func(ctx context.Context, booksID int64, in importStatementFileIn) (tool.Preview, error) {
		f, account, err := statementInput(ctx, booksID, files, in)
		if err != nil {
			return tool.Preview{}, err
		}

		byID, err := names(ctx, booksID)
		if err != nil {
			return tool.Preview{}, err
		}

		changes := []tool.Change{
			{Field: "source", After: tool.TextValue(f.Name)},
			{Field: "account", After: tool.TextValue(byID[account])},
			{Field: "count", After: tool.TextValue(strconv.Itoa(statementLines(f)))},
		}

		return tool.Preview{
			Action:  "import_statement_file",
			Changes: append(changes, statementPeriod(f)...),
		}, nil
	}
}

// statementInput reads the file and the account of a call: the file is an ofx or csv file of the
// member.
func statementInput(
	ctx context.Context,
	booksID int64,
	files ConversationFile,
	in importStatementFileIn,
) (StatementFile, uuid.UUID, error) {
	fileID, err := uuid.Parse(in.FileID)
	if err != nil {
		return StatementFile{}, uuid.Nil, tool.InvalidArgument("file_id", "is not a UUID")
	}

	account, err := uuid.Parse(in.AccountID)
	if err != nil {
		return StatementFile{}, uuid.Nil, tool.InvalidArgument("account_id", "is not a UUID")
	}

	f, found, err := files(ctx, booksID, auth.MustMemberID(ctx), fileID)
	if err != nil {
		return StatementFile{}, uuid.Nil, err
	}

	switch {
	case !found:
		return StatementFile{}, uuid.Nil, tool.InvalidArgument(
			"file_id",
			"is not a file of this conversation",
		)
	case f.Kind != "ofx" && f.Kind != "csv":
		return StatementFile{}, uuid.Nil, tool.InvalidArgument(
			"file_id",
			"is not an ofx or csv file",
		)
	}

	return f, account, nil
}

// statementPeriod is the period an ofx file declares; a csv file declares none, since its date
// column is known only through the profile of the account.
func statementPeriod(f StatementFile) []tool.Change {
	if f.Kind != "ofx" {
		return nil
	}

	// The scale only rounds amounts, which a period does not read.
	st, err := ofx.Parse(f.Content, 2)
	if err != nil || st.From == nil || st.To == nil {
		return nil
	}

	return []tool.Change{
		{Field: "from", After: tool.DateValue(*st.From)},
		{Field: "until", After: tool.DateValue(*st.To)},
	}
}

// statementLines counts the lines of a statement file: the transactions of an ofx file, the rows
// under the header of a csv file.
func statementLines(f StatementFile) int {
	if f.Kind == "ofx" {
		// The scale only rounds amounts, which a count does not read.
		st, err := ofx.Parse(f.Content, 2)
		if err != nil {
			return 0
		}

		return len(st.Records)
	}

	r := csv.NewReader(bytes.NewReader(f.Content))
	r.FieldsPerRecord = -1
	r.LazyQuotes = true

	rows, err := r.ReadAll()
	if err != nil || len(rows) == 0 {
		return 0
	}

	return len(rows) - 1
}
