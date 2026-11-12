package postgres

import (
	"encoding/json/v2"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

// scoreRow is one scored candidate as candidate_scores stores it (A100).
type scoreRow struct {
	TransactionID uuid.UUID `json:"transaction_id"`
	Score         int       `json:"score"`
	Amount        string    `json:"amount"`
	Date          string    `json:"date"`
	Counterparty  string    `json:"counterparty"`
}

func toRecord(row IngestionExternalRecord) (domain.ExternalRecord, error) {
	var raw map[string]string
	if err := json.Unmarshal(row.Raw, &raw); err != nil {
		return domain.ExternalRecord{}, err
	}

	var scores []scoreRow
	if err := json.Unmarshal(row.CandidateScores, &scores); err != nil {
		return domain.ExternalRecord{}, err
	}

	undo, err := decodeUndo(row.DecisionUndo)
	if err != nil {
		return domain.ExternalRecord{}, err
	}

	rec := recordOf(row, raw, undo)
	for _, s := range scores {
		rec.Scores = append(rec.Scores, domain.Scored{
			TransactionID: s.TransactionID,
			Score:         s.Score,
			Amount:        s.Amount,
			Date:          s.Date,
			Counterparty:  s.Counterparty,
		})
	}

	if row.InstallmentNumber != nil && row.InstallmentCount != nil {
		rec.Installment = &domain.Installment{
			Number: int(*row.InstallmentNumber),
			Count:  int(*row.InstallmentCount),
		}
	}

	return rec, nil
}

func recordOf(
	row IngestionExternalRecord,
	raw map[string]string,
	undo domain.Undo,
) domain.ExternalRecord {
	return domain.ExternalRecord{
		ID:          row.ID,
		BooksID:     row.BooksID,
		BatchID:     row.BatchID,
		AccountID:   row.AccountID,
		ExternalID:  value(row.ExternalID),
		DedupKey:    row.DedupKey,
		Raw:         raw,
		Date:        row.BookedOn,
		Amount:      row.Amount,
		Description: row.Description,
		State: domain.RecordState(
			row.State,
		),
		TransactionID: row.TransactionID.UUID,
		Candidates:    row.Candidates,
		ExternalStatus: value(
			row.ExternalStatus,
		),
		DueDate:         row.DueDate,
		CategoryID:      value(row.CategoryID),
		BalanceAfter:    row.BalanceAfter,
		LineKind:        value(row.LineKind),
		UnappliedChange: value(row.UnappliedChange),
		ReviewReason:    value(row.ReviewReason),
		InstitutionID:   value(row.InstitutionID),
		ReportedAmount:  row.ReportedAmount,
		ReportedOn:      row.ReportedOn,
		Counterparty:    value(row.Counterparty),
		Decision: domain.DecisionKind(
			value(row.Decision),
		),
		Undo:           undo,
		SummaryBatchID: row.SummaryBatchID.UUID,
		Kept:           row.Kept,
	}
}
