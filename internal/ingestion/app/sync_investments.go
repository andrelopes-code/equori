package app

import (
	"context"
	"fmt"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

// syncInvestments stores the investments of the item when the aggregator reads them (A236
// FC27); an aggregator without InvestmentReader reads none.
func (s *Service) syncInvestments(
	ctx context.Context,
	agg Aggregator,
	c *domain.Connection,
	creds domain.Credentials,
) error {
	reader, ok := agg.(InvestmentReader)
	if !ok {
		return nil
	}

	invs, err := reader.Investments(ctx, c.IntegrationID, creds, c.ExternalID)
	if err != nil {
		return fmt.Errorf("read investments: %w", err)
	}

	if len(invs) == 0 {
		return nil
	}

	if err := s.repo.StoreInvestments(ctx, c.BooksID, c.ID, invs); err != nil {
		return fmt.Errorf("store investments: %w", err)
	}

	return nil
}
