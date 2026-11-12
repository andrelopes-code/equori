package toolapi

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/planning/app"
	"github.com/andrelopes-code/equori/internal/planning/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

func fillOccurrences(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in listSchedulesIn,
	q scheduleQuery,
	descriptions map[uuid.UUID]string,
	out *listSchedulesOut,
) error {
	os, err := svc.Occurrences(ctx, booksID, q.from, q.to, q.scheduleID, domain.State(in.State))
	if err != nil {
		return err
	}

	page, nextCursor, err := tool.PageOf(
		os,
		func(o app.OccurrenceView) string { return o.ID.String() },
		in.PageArgs,
	)
	if err != nil {
		return err
	}

	out.NextCursor = nextCursor
	for _, o := range page {
		amount, err := moneyOf(o.Amount, o.Currency)
		if err != nil {
			return err
		}

		v := occurrenceView{
			OccurrenceID:   o.ID.String(),
			ScheduleID:     o.ScheduleID.String(),
			Description:    descriptions[o.ScheduleID],
			ExpectedOn:     tool.DateOf(o.ExpectedOn),
			ExpectedAmount: amount,
			State:          string(o.Shown),
		}
		if o.TransactionID != uuid.Nil {
			v.TransactionID = o.TransactionID.String()
		}

		out.Occurrences = append(out.Occurrences, v)
	}

	return nil
}

func committedViewOf(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	month time.Time,
) (committedView, error) {
	c, err := svc.Committed(ctx, booksID, month)
	if err != nil {
		return committedView{}, err
	}

	v := committedView{Month: month.Format(monthLayout)}
	for _, f := range []struct {
		amount int64
		into   *tool.Money
	}{{c.Installments, &v.Installments}, {c.Occurrences, &v.Occurrences}, {c.Total, &v.Total}} {
		if *f.into, err = moneyOf(f.amount, c.Currency); err != nil {
			return committedView{}, err
		}
	}

	return v, nil
}
