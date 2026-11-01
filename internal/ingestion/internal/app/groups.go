package app

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ingestion/internal/domain"
)

// groupedLines decides the lines of the batch that zone New puts in a group (A167, A168). It
// returns, by index in p.scoring, the entry each such line waits on.
func (s *Service) groupedLines(
	ctx context.Context,
	p *importPlan,
	assigned []domain.Assignment,
	repeated map[int]bool,
	postings []domain.LedgerPosting,
) (map[int]uuid.UUID, error) {
	if len(p.scoring) == 0 || len(postings) == 0 {
		return nil, nil
	}

	entries := freeEntries(postings, assigned)

	var (
		fresh []domain.ExternalRecord
		index = map[uuid.UUID]int{}
	)

	for i, a := range assigned {
		line := p.scoring[i]
		if a.Zone != domain.ZoneNew || repeated[i] || line.line.TransferTo != nil {
			continue
		}

		fresh = append(fresh, *line.rec)
		index[line.rec.ID] = i
	}

	if len(fresh) == 0 || len(entries) == 0 {
		return nil, nil
	}

	from, to := span(p.scoring)

	created, err := s.repo.CreatedRecords(ctx, p.batch.BooksID, p.batch.AccountID, from, to)
	if err != nil {
		return nil, err
	}

	lines, err := s.groupLines(ctx, p.batch.BooksID, fresh, created)
	if err != nil {
		return nil, err
	}

	out := map[int]uuid.UUID{}

	for _, m := range domain.FindGroups(entries, lines) {
		for _, id := range m.RecordIDs {
			if i, ok := index[id]; ok {
				out[i] = m.TransactionID
			}
		}
	}

	return out, nil
}

// groupLines turns records into the lines FindGroups takes: new for the records of the batch or
// in review, not new for the created ones that the ledger says a group may take over.
func (s *Service) groupLines(
	ctx context.Context,
	booksID int64,
	fresh, created []domain.ExternalRecord,
) ([]domain.GroupLine, error) {
	lines := make([]domain.GroupLine, 0, len(fresh)+len(created))
	for _, r := range fresh {
		lines = append(lines, domain.GroupLine{RecordID: r.ID, Date: r.Date, Amount: r.Amount, New: true})
	}

	if len(created) == 0 {
		return lines, nil
	}

	txIDs := make([]uuid.UUID, len(created))
	for i, r := range created {
		txIDs[i] = r.TransactionID
	}

	ok, err := s.ledger.GroupableTransactions(ctx, booksID, txIDs)
	if err != nil {
		return nil, err
	}

	groupable := make(map[uuid.UUID]bool, len(ok))
	for _, id := range ok {
		groupable[id] = true
	}

	for _, r := range created {
		if groupable[r.TransactionID] {
			lines = append(lines, domain.GroupLine{RecordID: r.ID, Date: r.Date, Amount: r.Amount})
		}
	}

	return lines, nil
}

// freeEntries drops the postings that a zone Link of the same batch takes.
func freeEntries(postings []domain.LedgerPosting, assigned []domain.Assignment) []domain.LedgerPosting {
	taken := map[uuid.UUID]bool{}

	for _, a := range assigned {
		if a.Zone == domain.ZoneLink {
			taken[a.TransactionID] = true
		}
	}

	var out []domain.LedgerPosting

	for _, posting := range postings {
		if !taken[posting.TransactionID] {
			out = append(out, posting)
		}
	}

	return out
}

// span is the window of the batch's lines widened by the hard limit of matching.
func span(lines []scoredLine) (from, to time.Time) {
	for _, l := range lines {
		if from.IsZero() || l.rec.Date.Before(from) {
			from = l.rec.Date
		}

		if l.rec.Date.After(to) {
			to = l.rec.Date
		}
	}

	return from.AddDate(0, 0, -domain.MatchHardLimit), to.AddDate(0, 0, domain.MatchHardLimit)
}

// groupMember is a record of a group; Created is true for a record whose transaction the import
// created in an earlier sync.
type groupMember struct {
	Record  domain.ExternalRecord
	Created bool
}

// groupOf computes again the group of a record in review reason group (A168). The members are
// ordered by date, then record id; ErrGroupChanged when no group holds the record.
func (s *Service) groupOf(ctx context.Context, rec domain.ExternalRecord) ([]groupMember, error) {
	if len(rec.Candidates) == 0 {
		return nil, ErrGroupChanged
	}

	entry := rec.Candidates[0]
	from, to := rec.Date.AddDate(0, 0, -domain.MatchHardLimit), rec.Date.AddDate(0, 0, domain.MatchHardLimit)

	postings, err := s.ledger.UnlinkedPostings(ctx, rec.BooksID, rec.AccountID, from, to)
	if err != nil {
		return nil, err
	}

	entries := slices.DeleteFunc(postings, func(p domain.LedgerPosting) bool { return p.TransactionID != entry })
	if len(entries) == 0 {
		return nil, ErrGroupChanged
	}

	review, err := s.repo.GroupRecords(ctx, rec.BooksID, rec.AccountID, entry)
	if err != nil {
		return nil, err
	}

	created, err := s.repo.CreatedRecords(ctx, rec.BooksID, rec.AccountID, from, to)
	if err != nil {
		return nil, err
	}

	lines, err := s.groupLines(ctx, rec.BooksID, review, created)
	if err != nil {
		return nil, err
	}

	for _, m := range domain.FindGroups(entries, lines) {
		if slices.Contains(m.RecordIDs, rec.ID) {
			return membersOf(m.RecordIDs, review, created), nil
		}
	}

	return nil, ErrGroupChanged
}

func membersOf(ids []uuid.UUID, review, created []domain.ExternalRecord) []groupMember {
	byID := map[uuid.UUID]groupMember{}

	for _, r := range created {
		byID[r.ID] = groupMember{Record: r, Created: true}
	}

	for _, r := range review {
		byID[r.ID] = groupMember{Record: r}
	}

	out := make([]groupMember, len(ids))
	for i, id := range ids {
		out[i] = byID[id]
	}

	slices.SortStableFunc(out, func(a, b groupMember) int { return a.Record.Date.Compare(b.Record.Date) })

	return out
}

// resolveGroup applies the resolution of one record to its whole group (A169).
func (s *Service) resolveGroup(
	ctx context.Context,
	booksID int64,
	rec domain.ExternalRecord,
	b domain.Batch,
	action string,
	txID uuid.UUID,
) (domain.ExternalRecord, domain.Batch, error) {
	members, err := s.groupOf(ctx, rec)
	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}

	switch action {
	case ActionMatch:
		if txID != rec.Candidates[0] {
			return domain.ExternalRecord{}, domain.Batch{}, &domain.FieldError{
				Field: "transaction_id", Message: "must be one of the record's candidates",
			}
		}

		err = s.confirmGroup(ctx, booksID, rec.AccountID, txID, members)
	case ActionCreate:
		err = s.createMembers(ctx, booksID, b, members, uuid.Nil)
	case ActionDiscard:
		err = s.discardMember(ctx, booksID, b, members, rec.ID)
	}

	if err != nil {
		return domain.ExternalRecord{}, domain.Batch{}, err
	}

	i := slices.IndexFunc(members, func(m groupMember) bool { return m.Record.ID == rec.ID })

	return members[i].Record, b, nil
}

// confirmGroup confirms the entry by the members' lines: the ledger splits its posting, the
// members in review become matched and are placed on their bills, and the members the import
// created follow the entry.
func (s *Service) confirmGroup(
	ctx context.Context,
	booksID int64,
	accountID, entry uuid.UUID,
	members []groupMember,
) error {
	parts := make([]GroupPart, len(members))

	for i, m := range members {
		parts[i] = GroupPart{
			RecordID: m.Record.ID, Amount: m.Record.Amount, Date: m.Record.Date,
			Pending: m.Record.ExternalStatus == domain.ExternalPending,
		}
		if m.Created {
			parts[i].CreatedTx = m.Record.TransactionID
		}
	}

	if err := s.ledger.ConfirmGroup(ctx, booksID, entry, accountID, parts); err != nil {
		return err
	}

	var followed []uuid.UUID

	for i := range members {
		rec := &members[i].Record
		if members[i].Created {
			followed = append(followed, rec.ID)

			continue
		}

		if err := s.billMatched(ctx, rec, parts[i].Pending); err != nil {
			return err
		}

		rec.State, rec.TransactionID, rec.Candidates = domain.StateMatched, entry, nil
		if err := s.repo.ResolveRecord(ctx, *rec); err != nil {
			return err
		}
	}

	if len(followed) == 0 {
		return nil
	}

	return s.repo.MoveRecords(ctx, booksID, followed, entry)
}

// discardMember discards one member and creates the other members in review.
func (s *Service) discardMember(
	ctx context.Context,
	booksID int64,
	b domain.Batch,
	members []groupMember,
	chosen uuid.UUID,
) error {
	i := slices.IndexFunc(members, func(m groupMember) bool { return m.Record.ID == chosen })
	rec := &members[i].Record
	rec.State, rec.Candidates = domain.StateDiscarded, nil

	if err := s.repo.ResolveRecord(ctx, *rec); err != nil {
		return err
	}

	return s.createMembers(ctx, booksID, b, members, chosen)
}

// createMembers records a transaction for each member in review but skip.
func (s *Service) createMembers(
	ctx context.Context,
	booksID int64,
	b domain.Batch,
	members []groupMember,
	skip uuid.UUID,
) error {
	var (
		lines []NewLine
		recs  []*domain.ExternalRecord
	)

	for i := range members {
		rec := &members[i].Record
		if members[i].Created || rec.ID == skip {
			continue
		}

		line := Line{
			AccountID: rec.AccountID, Currency: currencyOf(b), Date: rec.Date, Amount: rec.Amount,
			Description: truncate(rec.Description), Pending: rec.ExternalStatus == domain.ExternalPending,
		}
		lines, recs = append(lines, NewLine{RecordID: rec.ID, Line: line}), append(recs, rec)
	}

	ids, err := s.ledger.RecordImported(ctx, booksID, lines)
	if errors.Is(err, ErrLineRejected) {
		return &domain.FieldError{Field: "action", Message: err.Error()}
	}

	if err != nil {
		return err
	}

	for i, rec := range recs {
		rec.State, rec.TransactionID, rec.Candidates = domain.StateCreated, ids[i], nil
		if err := s.repo.ResolveRecord(ctx, *rec); err != nil {
			return err
		}
	}

	return nil
}
