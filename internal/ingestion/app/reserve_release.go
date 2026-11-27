package app

import (
	"context"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/domain"
)

// releaseLine is a new line of a sync held for RL2 and RL3 (A268); withdrawal is the index in
// p.pairs of the withdrawal line it pairs with, -1 for none.
type releaseLine struct {
	rec        *domain.ExternalRecord
	withdrawal int
}

// releasePair is a withdrawal line held out of p.creates until RL3 decides its pair.
type releasePair struct {
	line NewLine
	rec  *domain.ExternalRecord
}

// takePairs pairs the held release lines with the new withdrawal lines of D4 and holds the
// paired withdrawal lines out of p.creates (A268 RL2).
func (p *importPlan) takePairs() {
	if len(p.releases) == 0 {
		return
	}

	var (
		at          []int
		withdrawals []domain.PairLine
	)

	for i, c := range p.creates {
		if c.Line.TransferTo != nil && c.Line.Amount > 0 && !c.Line.Pending {
			at = append(at, i)
			withdrawals = append(
				withdrawals,
				domain.PairLine{At: p.at[c.RecordID], Amount: c.Line.Amount},
			)
		}
	}

	releases := make([]domain.PairLine, len(p.releases))
	for i, r := range p.releases {
		releases[i] = domain.PairLine{At: p.at[r.rec.ID], Amount: r.rec.Amount}
	}

	var taken []int

	for i, j := range domain.PairReleases(releases, withdrawals) {
		p.releases[i].withdrawal = -1

		if j < 0 {
			continue
		}

		k := at[j]
		p.releases[i].withdrawal = len(p.pairs)
		p.pairs = append(p.pairs, releasePair{line: p.creates[k], rec: p.created[k]})
		taken = append(taken, k)
	}

	slices.Sort(taken)

	for _, k := range slices.Backward(taken) {
		p.creates, p.created = slices.Delete(p.creates, k, k+1), slices.Delete(p.created, k, k+1)
	}
}

// settleReleases books the held pairs once every other line is recorded: with the retained
// amount when both reported balances confirm them (RL3, RL4), as D4 transfers otherwise. A
// release line without a booked pair waits for review (RL5).
func (s *Service) settleReleases(ctx context.Context, p *importPlan) error {
	if len(p.releases) == 0 {
		return nil
	}

	confirmed, err := s.confirmPairs(ctx, p)
	if err != nil {
		return err
	}

	creates := make([]NewLine, len(p.pairs))
	created := make([]*domain.ExternalRecord, len(p.pairs))

	for i, pair := range p.pairs {
		creates[i], created[i] = pair.line, pair.rec
	}

	for _, r := range p.releases {
		if confirmed && r.withdrawal >= 0 {
			creates[r.withdrawal].Line.Retained = -r.rec.Amount - creates[r.withdrawal].Line.Amount
		}
	}

	if err := s.create(ctx, p.batch.BooksID, p.sync, p.opensOn, creates, created); err != nil {
		return err
	}

	for _, r := range p.releases {
		r.rec.State, r.rec.ReviewReason = domain.StateNeedsReview, domain.ReviewReserveRelease

		booked := r.withdrawal >= 0 && p.pairs[r.withdrawal].rec.State == domain.StateCreated
		if confirmed && booked {
			// The reason is cleared: a line the owner reopens is not decided again (RL6).
			r.rec.State, r.rec.ReviewReason = domain.StateDiscarded, ""
		}
	}

	return nil
}

// confirmPairs reports whether the account's reported balance and the amount of each reserve
// of a pair hold the pairs with their release amounts on the reserves (A268 RL3).
func (s *Service) confirmPairs(ctx context.Context, p *importPlan) (bool, error) {
	if len(p.pairs) == 0 || p.source.balance == nil || p.closedBefore == nil {
		return false, nil
	}

	released := map[uuid.UUID]int64{}
	for _, r := range p.releases {
		if r.withdrawal >= 0 {
			released[*p.pairs[r.withdrawal].line.Line.TransferTo] -= r.rec.Amount
		}
	}

	for account, amount := range released {
		ok, err := s.reserveConfirms(ctx, p, account, amount)
		if err != nil || !ok {
			return false, err
		}
	}

	gap, err := s.missing(ctx, p.batch.BooksID, p.batch.AccountID, *p.source.balance)
	if err != nil {
		return false, err
	}

	for _, pair := range p.pairs {
		gap -= pair.line.Line.Amount
	}

	return s.yieldsClose(ctx, p, released, gap)
}

// reserveConfirms applies RL3 to one reserve of a pair: its reported amount, less what it adds
// to the settled balance without the released amount, lies within the bound of D3.
func (s *Service) reserveConfirms(
	ctx context.Context,
	p *importPlan,
	account uuid.UUID,
	released int64,
) (bool, error) {
	i := slices.IndexFunc(p.source.reserves, func(x domain.ExternalAccount) bool {
		return x.AccountID != nil && *x.AccountID == account
	})
	if i < 0 {
		return false, nil
	}

	balance, err := p.source.read(ctx, p.source.reserves[i], p.currency.MinorUnits())
	if err != nil || balance == nil {
		return false, err
	}

	last, err := s.ledger.LastBalanceReconciledOn(ctx, p.batch.BooksID, account)
	if err != nil || last == nil {
		return false, err
	}

	settled, err := s.ledger.SettledBalance(ctx, p.batch.BooksID, account, balance.Date)
	if err != nil {
		return false, err
	}

	bound, err := s.ledger.ReserveYieldBound(
		ctx,
		p.batch.BooksID,
		account,
		settled,
		*last,
		balance.Date,
	)
	if err != nil {
		return false, err
	}

	return domain.ReserveConfirms(balance.Amount, settled, released, bound), nil
}

// yieldsClose reports whether the yield lines of the sync close gap, the bank gap without the
// release lines, with none waiting (RY3 to RY5), the reserves holding the released amounts.
func (s *Service) yieldsClose(
	ctx context.Context,
	p *importPlan,
	released map[uuid.UUID]int64,
	gap int64,
) (bool, error) {
	if len(p.yields) == 0 {
		return gap == 0, nil
	}

	spans, err := s.reserveYields(ctx, p, released)
	if err != nil {
		return false, err
	}

	var own int64

	for i, outcome := range domain.DecideYields(yieldLines(p.yields), spans, &gap) {
		switch outcome {
		case domain.YieldReview:
			return false, nil
		case domain.YieldOwn:
			own += p.yields[i].rec.Amount
		}
	}

	return own == gap, nil
}
