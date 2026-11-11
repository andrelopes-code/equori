package ledger

import "context"

// Transfer replaces the category side of a transaction with a posting on another account,
// pairing it with the imported other side when one exists.
func (m *Module) Transfer(ctx context.Context, booksID int64, r TransferRequest) (TransferResult, error) {
	return m.svc.Transfer(ctx, booksID, r)
}
