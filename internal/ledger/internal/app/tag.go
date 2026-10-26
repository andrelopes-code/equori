package app

import (
	"context"
	"errors"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/ledger/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/outbox"
)

const (
	EventTagRenamed  = "ledger.tag_renamed.v1"
	EventTagDeleted  = "ledger.tag_deleted.v1"
	reasonTagDeleted = "tag deleted"
)

// TagUsage is a tag and the number of non-voided transactions that carry it.
type TagUsage struct {
	ID           uuid.UUID
	Name         string
	Transactions int
}

// TagRenamed is the payload of EventTagRenamed: after a rename or a merge, From names no tag
// and Into names the one that carries its transactions.
type TagRenamed struct {
	From string `json:"from"`
	Into string `json:"into"`
}

// TagDeleted is the payload of EventTagDeleted.
type TagDeleted struct {
	Name string `json:"name"`
}

func (s *Service) Tag(ctx context.Context, userID int64, name string) (TagUsage, error) {
	return s.repo.TagUsage(ctx, userID, name)
}

// RenameTag changes the name of a tag in place: no transaction gets a new version.
func (s *Service) RenameTag(ctx context.Context, userID int64, name, newName string) (TagUsage, error) {
	newName, err := domain.NormalizeTag(newName, "name")
	if err != nil {
		return TagUsage{}, err
	}
	var tag TagUsage
	err = s.repo.InTx(ctx, func(r Repository) error {
		if tag, err = r.TagUsage(ctx, userID, name); err != nil || tag.Name == newName {
			return err
		}
		if err := r.RenameTag(ctx, userID, tag.ID, newName); err != nil {
			return err
		}
		tag.Name = newName
		return r.Publish(ctx, outbox.Event{Type: EventTagRenamed, UserID: userID, AggregateID: tag.ID.String(), Payload: TagRenamed{From: name, Into: newName}})
	})
	return tag, err
}

// MergeTag gives every non-voided transaction of from a new version carrying into, moves
// the voided ones in place and deletes from. It returns into.
func (s *Service) MergeTag(ctx context.Context, userID int64, from, into string) (TagUsage, error) {
	var dest TagUsage
	err := s.repo.InTx(ctx, func(r Repository) error {
		src, err := r.TagUsage(ctx, userID, from)
		if err != nil {
			return err
		}
		invalid := func(message string) error {
			return &domain.FieldError{Field: "into", Message: message, Err: domain.ErrValidation}
		}
		if dest, err = r.TagUsage(ctx, userID, into); errors.Is(err, ErrNotFound) {
			return invalid("unknown tag")
		} else if err != nil {
			return err
		}
		if src.ID == dest.ID {
			return invalid("must differ from the tag")
		}
		replace := func(tags []string) []string {
			out := append(slices.DeleteFunc(slices.Clone(tags), func(t string) bool { return t == from }), into)
			slices.Sort(out)
			return slices.Compact(out)
		}
		if err := retag(ctx, r, userID, src.ID, replace, reasonMerged); err != nil {
			return err
		}
		if err := r.MoveTagLinks(ctx, userID, src.ID, dest.ID); err != nil {
			return err
		}
		if err := r.DeleteTag(ctx, userID, src.ID); err != nil {
			return err
		}
		if dest, err = r.TagUsage(ctx, userID, into); err != nil {
			return err
		}
		return r.Publish(ctx, outbox.Event{Type: EventTagRenamed, UserID: userID, AggregateID: src.ID.String(), Payload: TagRenamed{From: from, Into: into}})
	})
	return dest, err
}

// DeleteTag gives every non-voided transaction of the tag a new version without it; the
// voided ones lose it in place.
func (s *Service) DeleteTag(ctx context.Context, userID int64, name string) error {
	return s.repo.InTx(ctx, func(r Repository) error {
		tag, err := r.TagUsage(ctx, userID, name)
		if err != nil {
			return err
		}
		drop := func(tags []string) []string {
			return slices.DeleteFunc(slices.Clone(tags), func(t string) bool { return t == name })
		}
		if err := retag(ctx, r, userID, tag.ID, drop, reasonTagDeleted); err != nil {
			return err
		}
		if err := r.DeleteTag(ctx, userID, tag.ID); err != nil {
			return err
		}
		return r.Publish(ctx, outbox.Event{Type: EventTagDeleted, UserID: userID, AggregateID: tag.ID.String(), Payload: TagDeleted{Name: name}})
	})
}

// retag writes a new version of each non-voided transaction that carries the tag, with
// its tags passed through change. The version keeps its categorization method (CauseMerge).
func retag(ctx context.Context, r Repository, userID int64, tagID uuid.UUID, change func([]string) []string, reason string) error {
	ids, err := r.TransactionsWithTag(ctx, userID, tagID)
	if err != nil {
		return err
	}
	for _, id := range ids {
		prev, err := r.LockTransaction(ctx, userID, id)
		if err != nil {
			return err
		}
		next := prev
		next.Tags = change(prev.Tags)
		next.Version++
		accounts, err := r.Accounts(ctx, userID, postingAccounts(prev))
		if err != nil {
			return err
		}
		if err := r.ReplaceCategoryPostings(ctx, prev, next, reason); err != nil {
			return err
		}
		event := newTransactionEvent(next, accounts, prev)
		event.Cause = &Cause{Method: CauseMerge}
		if err := r.Publish(ctx, outbox.Event{Type: EventTransactionCategorized, UserID: userID, AggregateID: next.ID.String(), Payload: event}); err != nil {
			return err
		}
	}
	return nil
}
