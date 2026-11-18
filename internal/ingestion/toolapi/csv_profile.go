package toolapi

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// csvDelimiters are the delimiters of a CSV profile by the names of saveCsvProfile.
var csvDelimiters = map[string]string{"comma": ",", "semicolon": ";", "tab": "\t", "pipe": "|"}

type csvDelimiter string

func (csvDelimiter) Values() []string { return []string{"comma", "semicolon", "tab", "pipe"} }

type csvDecimalSeparator string

func (csvDecimalSeparator) Values() []string { return []string{",", "."} }

type csvAmountSign string

func (csvAmountSign) Values() []string { return []string{"as_is", "inverted"} }

type getCSVProfileIn struct {
	AccountID string `json:"account_id" jsonschema:"account whose csv files the profile reads"`
}

type csvProfileIn struct {
	AccountID         string              `json:"account_id"               jsonschema:"account whose csv files the profile reads"`
	Delimiter         csvDelimiter        `json:"delimiter,omitzero"       jsonschema:"comma when absent"`
	HeaderRows        tool.OptionalInt    `json:"header_rows,omitzero"     jsonschema:"rows above the data, 0 to 10; 1 when absent"`
	DateColumn        string              `json:"date_column"              jsonschema:"header name of the date column, or its position for a file without a header"`
	DateLayout        string              `json:"date_layout"              jsonschema:"order and separator of the date, such as DD/MM/YYYY"`
	AmountColumn      string              `json:"amount_column,omitzero"   jsonschema:"column of a signed amount; or debit_column and credit_column"`
	DebitColumn       string              `json:"debit_column,omitzero"    jsonschema:"column of debits"`
	CreditColumn      string              `json:"credit_column,omitzero"   jsonschema:"column of credits"`
	DecimalSeparator  csvDecimalSeparator `json:"decimal_separator"        jsonschema:"decimal separator of amounts"`
	DescriptionColumn string              `json:"description_column"       jsonschema:"column of the description"`
	IDColumn          string              `json:"id_column,omitzero"       jsonschema:"column of the bank's id of a line"`
	AmountSign        csvAmountSign       `json:"amount_sign,omitzero"     jsonschema:"inverted flips every sign, for card exports that list charges as positive"`
	Encoding          string              `json:"encoding,omitzero"        jsonschema:"text encoding; auto keeps UTF-8 and reads anything else as windows-1252"`
	GroupSeparator    string              `json:"group_separator,omitzero" jsonschema:"digit group separator; the one that is not decimal_separator when absent"`
	FooterRows        tool.OptionalInt    `json:"footer_rows,omitzero"     jsonschema:"rows under the data, 0 to 10"`
	SignColumn        string              `json:"sign_column,omitzero"     jsonschema:"column that says whether a line is a debit; needs debit_marker"`
	DebitMarker       string              `json:"debit_marker,omitzero"    jsonschema:"text that marks a debit, compared without case"`
}

func getCSVProfile(svc *app.Service) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_csv_profile",
		Description: "Returns how the csv files of one account are read, as Import statement shows it: delimiter, " +
			"header and footer rows, the columns of date, amount or debit and credit, description and id, the " +
			"date layout and the number format. Use it before importing a csv file or changing the profile. " +
			"Do not use it for an ofx file, which needs no profile.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, booksID int64, in getCSVProfileIn) (csvProfileIn, error) {
		account, err := uuid.Parse(in.AccountID)
		if err != nil {
			return csvProfileIn{}, tool.InvalidArgument("account_id", "is not a UUID")
		}

		p, err := svc.Profile(ctx, booksID, account)
		if err != nil {
			return csvProfileIn{}, err
		}

		return csvProfileOf(p), nil
	})
}

func saveCSVProfile(svc *app.Service, names AccountNames) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "save_csv_profile",
		Description: "Proposes setting how the csv files of one account are read, as Import statement does; it " +
			"replaces the whole profile. Read the masked sample of the [file ...] line of an attached csv to " +
			"choose the columns by their header names. Use it before import_statement_file when the account has " +
			"no profile or the file does not match it. Do not use it for an ofx file. The user confirms first.",
		Effect: tool.Write,
		Role:   auth.RoleWrite,
	}, func(ctx context.Context, booksID int64, in csvProfileIn) (tool.Preview, error) {
		p, err := profileOf(booksID, in)
		if err != nil {
			return tool.Preview{}, err
		}

		byID, err := names(ctx, booksID)
		if err != nil {
			return tool.Preview{}, err
		}

		columns := []string{
			p.DateColumn,
			p.AmountColumn,
			p.DebitColumn,
			p.CreditColumn,
			p.DescriptionColumn,
		}

		return tool.Preview{Action: "save_csv_profile", Changes: []tool.Change{
			{Field: "account", After: tool.TextValue(byID[p.AccountID])},
			{
				Field: "pattern",
				After: tool.TextValue(string(p.DateLayout) + " " + joinSet(columns)),
			},
		}}, nil
	}, func(ctx context.Context, booksID int64, in csvProfileIn) (csvProfileIn, error) {
		p, err := profileOf(booksID, in)
		if err != nil {
			return csvProfileIn{}, err
		}

		saved, err := svc.SaveProfile(ctx, p)
		if err != nil {
			return csvProfileIn{}, err
		}

		return csvProfileOf(saved), nil
	})
}

// profileOf maps a call to the profile saveCsvProfile builds from the same fields.
func profileOf(booksID int64, in csvProfileIn) (domain.Profile, error) {
	account, err := uuid.Parse(in.AccountID)
	if err != nil {
		return domain.Profile{}, tool.InvalidArgument("account_id", "is not a UUID")
	}

	p := domain.Profile{
		BooksID:           booksID,
		AccountID:         account,
		Delimiter:         csvDelimiters[string(in.Delimiter)],
		HeaderRows:        1,
		DateColumn:        in.DateColumn,
		DateLayout:        domain.DateLayout(in.DateLayout),
		AmountColumn:      in.AmountColumn,
		DebitColumn:       in.DebitColumn,
		CreditColumn:      in.CreditColumn,
		DecimalSeparator:  string(in.DecimalSeparator),
		DescriptionColumn: in.DescriptionColumn,
		IDColumn:          in.IDColumn,
		AmountSign:        domain.AmountSign(in.AmountSign),
		Encoding:          in.Encoding,
		GroupSeparator:    in.GroupSeparator,
		FooterRows:        in.FooterRows.N,
		SignColumn:        in.SignColumn,
		DebitMarker:       in.DebitMarker,
	}

	if in.HeaderRows.Set {
		p.HeaderRows = in.HeaderRows.N
	}

	if p.GroupSeparator == "" {
		p.GroupSeparator = map[string]string{",": ".", ".": ","}[p.DecimalSeparator]
	}

	return p, nil
}

func csvProfileOf(p domain.Profile) csvProfileIn {
	out := csvProfileIn{
		AccountID:         p.AccountID.String(),
		HeaderRows:        tool.OptionalInt{N: p.HeaderRows, Set: true},
		DateColumn:        p.DateColumn,
		DateLayout:        string(p.DateLayout),
		AmountColumn:      p.AmountColumn,
		DebitColumn:       p.DebitColumn,
		CreditColumn:      p.CreditColumn,
		DecimalSeparator:  csvDecimalSeparator(p.DecimalSeparator),
		DescriptionColumn: p.DescriptionColumn,
		IDColumn:          p.IDColumn,
		AmountSign:        csvAmountSign(p.AmountSign),
		Encoding:          p.Encoding,
		GroupSeparator:    p.GroupSeparator,
		FooterRows:        tool.OptionalInt{N: p.FooterRows, Set: true},
		SignColumn:        p.SignColumn,
		DebitMarker:       p.DebitMarker,
	}

	for name, d := range csvDelimiters {
		if d == p.Delimiter {
			out.Delimiter = csvDelimiter(name)
		}
	}

	return out
}

// joinSet joins the names that are not empty.
func joinSet(names []string) string {
	var set []string
	for _, n := range names {
		if n != "" {
			set = append(set, n)
		}
	}

	return strings.Join(set, ", ")
}
