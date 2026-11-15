package toolapi

import (
	"context"
	"slices"

	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// planWithStatement puts the statement's month first among the changes of every action.
func (s settleStep) planWithStatement(
	ctx context.Context,
	pv tool.Preview,
	reference string,
) (tool.Preview, func() (settleStatementOut, error), error) {
	pv, run, err := s.plan(ctx, pv)
	if err != nil {
		return pv, nil, err
	}

	pv.Changes = slices.Insert(pv.Changes, 0, tool.Change{
		Field: "statement",
		After: tool.TextValue(reference),
	})

	return pv, run, nil
}
