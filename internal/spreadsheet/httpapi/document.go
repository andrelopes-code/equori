package httpapi

import (
	"context"
	"encoding/json/v2"
	"fmt"
	"net/http"

	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/spreadsheet/domain"
)

func (s *Server) listSpreadsheets(
	ctx context.Context, _ *http.Request, _ httpserver.None,
) (SpreadsheetList, error) {
	docs, err := s.svc.List(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return SpreadsheetList{}, err
	}

	out := SpreadsheetList{Items: make([]SpreadsheetSummary, len(docs))}
	for i, d := range docs {
		out.Items[i] = toSummaryAPI(d)
	}

	return out, nil
}

func (s *Server) createSpreadsheet(
	ctx context.Context, _ *http.Request, in CreateSpreadsheetJSONRequestBody,
) (Spreadsheet, string, error) {
	content, err := encodeContent(in.Content)
	if err != nil {
		return Spreadsheet{}, "", err
	}

	d, err := s.svc.Create(ctx, auth.MustBooksID(ctx), in.Name, content)
	if err != nil {
		return Spreadsheet{}, "", err
	}

	out, err := toDocumentAPI(d)

	return out, BaseURL + "/spreadsheets/" + d.ID.String(), err
}

func (s *Server) getSpreadsheet(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (Spreadsheet, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return Spreadsheet{}, err
	}

	d, err := s.svc.Document(ctx, auth.MustBooksID(ctx), id)
	if err != nil {
		return Spreadsheet{}, err
	}

	return toDocumentAPI(d)
}

func (s *Server) saveSpreadsheet(
	ctx context.Context, r *http.Request, in SaveSpreadsheetJSONRequestBody,
) (SpreadsheetSummary, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return SpreadsheetSummary{}, err
	}

	content, err := encodeContent(in.Content)
	if err != nil {
		return SpreadsheetSummary{}, err
	}

	d, err := s.svc.Save(ctx, auth.MustBooksID(ctx), id, in.Version, content)
	if err != nil {
		return SpreadsheetSummary{}, err
	}

	return toSummaryAPI(d), nil
}

func (s *Server) renameSpreadsheet(
	ctx context.Context, r *http.Request, in RenameSpreadsheetJSONRequestBody,
) (SpreadsheetSummary, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return SpreadsheetSummary{}, err
	}

	d, err := s.svc.Rename(ctx, auth.MustBooksID(ctx), id, in.Name)
	if err != nil {
		return SpreadsheetSummary{}, err
	}

	return toSummaryAPI(d), nil
}

func (s *Server) copySpreadsheet(
	ctx context.Context, r *http.Request, in CopySpreadsheetJSONRequestBody,
) (SpreadsheetSummary, string, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return SpreadsheetSummary{}, "", err
	}

	d, err := s.svc.Copy(ctx, auth.MustBooksID(ctx), id, in.Name)
	if err != nil {
		return SpreadsheetSummary{}, "", err
	}

	return toSummaryAPI(d), BaseURL + "/spreadsheets/" + d.ID.String(), nil
}

func (s *Server) deleteSpreadsheet(
	ctx context.Context, r *http.Request, _ httpserver.None,
) (httpserver.None, error) {
	id, err := httpserver.PathUUID(r, "id")
	if err != nil {
		return httpserver.None{}, err
	}

	return httpserver.None{}, s.svc.Delete(ctx, auth.MustBooksID(ctx), id)
}

func encodeContent(content SpreadsheetContent) ([]byte, error) {
	if content == nil {
		return nil, &domain.FieldError{Field: "content", Message: "is required"}
	}

	b, err := json.Marshal(content)
	if err != nil {
		return nil, fmt.Errorf("encode content: %w", err)
	}

	return b, nil
}

func toSummaryAPI(d domain.Summary) SpreadsheetSummary {
	return SpreadsheetSummary{
		Id:        d.ID,
		Name:      d.Name,
		Version:   d.Version,
		CreatedAt: d.CreatedAt,
		UpdatedAt: d.UpdatedAt,
	}
}

func toDocumentAPI(d domain.Document) (Spreadsheet, error) {
	var content SpreadsheetContent
	if err := json.Unmarshal(d.Content, &content); err != nil {
		return Spreadsheet{}, fmt.Errorf("decode content of %s: %w", d.ID, err)
	}

	return Spreadsheet{
		Id:        d.ID,
		Name:      d.Name,
		Version:   d.Version,
		CreatedAt: d.CreatedAt,
		UpdatedAt: d.UpdatedAt,
		Content:   content,
	}, nil
}
