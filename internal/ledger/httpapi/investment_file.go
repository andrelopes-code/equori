package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
)

// maxInvestmentFileBytes stays under the default request body limit of 1 MiB.
const maxInvestmentFileBytes = 1 << 20

// maxFormValueBytes bounds the text fields of the form.
const maxFormValueBytes = 64

// importInvestmentFile is a custom handler: the request body is multipart.
func (s *Server) importInvestmentFile(w http.ResponseWriter, r *http.Request) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	reader, err := r.MultipartReader()
	if err != nil {
		s.errs.WriteRequestError(w, r, fmt.Errorf("can't decode multipart body: %w", err))

		return
	}

	f, err := readInvestmentFile(reader)
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	f.BrokerageID = id

	out, err := s.svc.ImportInvestmentFile(r.Context(), auth.MustBooksID(r.Context()), f)
	if err != nil {
		s.errs.Write(w, r, err)

		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(InvestmentFileResult{
		Lines: out.Lines, Created: out.Created, Skipped: out.Skipped,
	})
}

// readInvestmentFile reads the file and the optional fields of the form, in any order.
func readInvestmentFile(body *multipart.Reader) (app.InvestmentFile, error) {
	var (
		f    app.InvestmentFile
		seen bool
	)

	for {
		part, err := body.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}

		if err != nil {
			return app.InvestmentFile{}, errors.Join(errInvalidRequest, err)
		}

		if part.FormName() == "file" {
			f.Content, err = io.ReadAll(io.LimitReader(part, maxInvestmentFileBytes))
			seen = true
		} else {
			err = readFormField(part, &f)
		}

		if err != nil {
			return app.InvestmentFile{}, err
		}
	}

	if !seen {
		return app.InvestmentFile{}, &domain.FieldError{
			Field: "file", Message: "is required", Err: domain.ErrValidation,
		}
	}

	return f, nil
}

func readFormField(part *multipart.Part, f *app.InvestmentFile) error {
	name := part.FormName()

	value, err := io.ReadAll(io.LimitReader(part, maxFormValueBytes))
	if err != nil {
		return errors.Join(errInvalidRequest, err)
	}

	switch name {
	case "cash_account_id":
		f.CashAccountID, err = uuid.Parse(string(value))
	case "category_id":
		f.CategoryID, err = uuid.Parse(string(value))
	case "dry_run":
		f.DryRun, err = strconv.ParseBool(string(value))
	}

	if err != nil {
		return &domain.FieldError{Field: name, Message: "is invalid", Err: domain.ErrValidation}
	}

	return nil
}
