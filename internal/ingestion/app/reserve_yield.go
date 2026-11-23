package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

// yieldSource reads what decides the yield lines of a bank account whose connection lists
// reserved balances (A264).
type yieldSource struct {
	// balance is the balance the aggregator reports for the account; nil for none.
	balance  *domain.Balance
	reserves []domain.ExternalAccount
	read     func(context.Context, domain.ExternalAccount, int) (*domain.Balance, error)
}

// yieldSourceOf returns nil for an account whose yield lines follow the ordinary rules.
func yieldSourceOf(
	agg Aggregator,
	c domain.Connection,
	ext domain.ExternalAccount,
	creds domain.Credentials,
	balance *domain.Balance,
) *yieldSource {
	if ext.Subtype == domain.SubtypeReservedBalance {
		return nil
	}

	src := yieldSource{balance: balance}
	for _, x := range c.Accounts {
		if x.Subtype == domain.SubtypeReservedBalance {
			src.reserves = append(src.reserves, x)
		}
	}

	if len(src.reserves) == 0 {
		return nil
	}

	src.read = func(
		ctx context.Context,
		reserve domain.ExternalAccount,
		scale int,
	) (*domain.Balance, error) {
		read, err := agg.ReadAccount(
			ctx, c.IntegrationID, creds, c.ExternalID, reserve.ExternalID,
			time.Time{}, time.Time{}, nil, scale,
		)
		if errors.Is(err, ErrAccountGone) {
			return nil, nil
		}

		if err != nil {
			return nil, fmt.Errorf("account %s: %w", reserve.ID, err)
		}

		return read.Balance, nil
	}

	return &src
}

// yieldLine is a yield line to decide; held already waits for review.
type yieldLine struct {
	rec          *domain.ExternalRecord
	line         Line
	closed, held bool
}

// yieldAgain takes a yield line that waits for review, which a yield booked since may explain.
func (p *importPlan) yieldAgain(rec *domain.ExternalRecord, r domain.NormalizedRecord) bool {
	if p.source == nil || !r.Yield || rec.State != domain.StateNeedsReview {
		return false
	}

	closed := rec.ReviewReason == domain.ReviewReconciled
	if !closed && rec.ReviewReason != domain.ReviewYield {
		return false
	}

	p.yields = append(
		p.yields,
		yieldLine{rec: rec, line: p.lineOf(rec, r), closed: closed, held: true},
	)

	return true
}

// settleYields decides the yield lines once every other line is recorded, so that the settled
// balances of the account and of its reserves lack only yield (A264).
func (s *Service) settleYields(ctx context.Context, p *importPlan) error {
	if len(p.yields) == 0 {
		return nil
	}

	spans, err := s.reserveYields(ctx, p)
	if err != nil {
		return err
	}

	gap, err := s.yieldGap(ctx, p)
	if err != nil {
		return err
	}

	var (
		creates []NewLine
		created []*domain.ExternalRecord
	)

	for i, outcome := range domain.DecideYields(yieldLines(p.yields), spans, gap) {
		y := p.yields[i]

		switch outcome {
		case domain.YieldOwn:
			y.rec.ReviewReason = ""
			creates = append(creates, NewLine{RecordID: y.rec.ID, Line: y.line})
			created = append(created, y.rec)
		case domain.YieldReserve:
			// The reason is cleared: a line the owner reopens is not decided again (RY8).
			y.rec.State, y.rec.ReviewReason = domain.StateDiscarded, ""
		case domain.YieldReview:
			y.rec.State, y.rec.ReviewReason = domain.StateNeedsReview, yieldReason(y)
		}
	}

	err = s.create(ctx, p.batch.BooksID, p.sync, p.opensOn, creates, created)
	if err != nil {
		return err
	}

	return s.saveHeldYields(ctx, p)
}

// reserveYields returns the yields of the mapped reserves the lines may report: the booked ones,
// and the one the reported amount adds to the settled balance.
func (s *Service) reserveYields(ctx context.Context, p *importPlan) ([]domain.YieldSpan, error) {
	from := p.yields[0].rec.Date
	for _, y := range p.yields {
		if y.rec.Date.Before(from) {
			from = y.rec.Date
		}
	}

	var spans []domain.YieldSpan

	for _, reserve := range p.source.reserves {
		if reserve.State() != domain.MappingMapped {
			continue
		}

		booked, err := s.ledger.YieldsSince(ctx, p.batch.BooksID, *reserve.AccountID, from)
		if err != nil {
			return nil, err
		}

		spans = append(spans, booked...)

		reported, err := s.reportedYield(ctx, p, reserve)
		if err != nil {
			return nil, err
		}

		if reported != nil {
			spans = append(spans, *reported)
		}
	}

	return spans, nil
}

// reportedYield is what the reserve's reported amount adds to its settled balance; nil without a
// positive difference or a reconciled balance to count the days from.
func (s *Service) reportedYield(
	ctx context.Context,
	p *importPlan,
	reserve domain.ExternalAccount,
) (*domain.YieldSpan, error) {
	balance, err := p.source.read(ctx, reserve, p.currency.MinorUnits())
	if err != nil || balance == nil {
		return nil, err
	}

	last, err := s.ledger.LastBalanceReconciledOn(ctx, p.batch.BooksID, *reserve.AccountID)
	if err != nil || last == nil {
		return nil, err
	}

	missing, err := s.missing(ctx, p.batch.BooksID, *reserve.AccountID, *balance)
	if err != nil || missing <= 0 {
		return nil, err
	}

	from := last.AddDate(0, 0, 1)
	if from.After(balance.Date) {
		from = balance.Date
	}

	return &domain.YieldSpan{From: from, To: balance.Date, Amount: missing}, nil
}

// yieldGap is what the account's reported balance still lacks; nil when no balance is reported or
// none was ever reconciled, and the difference may predate the lines.
func (s *Service) yieldGap(ctx context.Context, p *importPlan) (*int64, error) {
	if p.source.balance == nil || p.closedBefore == nil {
		return nil, nil
	}

	gap, err := s.missing(ctx, p.batch.BooksID, p.batch.AccountID, *p.source.balance)
	if err != nil {
		return nil, err
	}

	return &gap, nil
}

func (s *Service) missing(
	ctx context.Context,
	booksID int64,
	accountID uuid.UUID,
	b domain.Balance,
) (int64, error) {
	settled, err := s.ledger.SettledBalance(ctx, booksID, accountID, b.Date)

	return b.Amount - settled, err
}

func yieldLines(yields []yieldLine) []domain.YieldLine {
	lines := make([]domain.YieldLine, len(yields))
	for i, y := range yields {
		lines[i] = domain.YieldLine{
			Date:   y.rec.Date,
			Amount: y.rec.Amount,
			Closed: y.closed,
			Held:   y.held,
		}
	}

	return lines
}

func yieldReason(y yieldLine) string {
	if y.closed {
		return domain.ReviewReconciled
	}

	return domain.ReviewYield
}

// saveHeldYields stores the decided lines that waited for review in the batch that counts them.
func (s *Service) saveHeldYields(ctx context.Context, p *importPlan) error {
	for _, y := range p.yields {
		if !y.held {
			continue
		}

		if y.rec.State == domain.StateNeedsReview {
			p.batch.Counts.Ignored++
			continue
		}

		if err := s.repo.ResolveRecord(ctx, *y.rec); err != nil {
			return err
		}

		p.batch.Counts.Updated++
	}

	return nil
}
