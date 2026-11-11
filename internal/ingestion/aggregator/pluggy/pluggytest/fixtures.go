package pluggytest

import (
	"slices"

	"github.com/andrelopes-code/equori/internal/ingestion/aggregator/pluggy/client"
)

// SetCredentials adds an application or replaces its secret.
func (s *Server) SetCredentials(clientID, secret string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.secrets[clientID] = secret
}

// AddItem adds or replaces an item of the application New created.
func (s *Server) AddItem(it client.Item) { s.AddItemTo(s.first, it) }

// AddItemTo adds or replaces an item of an application.
func (s *Server) AddItemTo(clientID string, it client.Item) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.items[it.ID] = it
	s.owners[it.ID] = clientID
}

func (s *Server) AddAccount(itemID string, a client.Account) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.accounts[itemID] = append(s.accounts[itemID], a)
}

// RenameAccount changes the name an item reports for an account.
func (s *Server) RenameAccount(accountID, name string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.eachAccount(accountID, func(a *client.Account) { a.Name = name })
}

// ChangeAccountID makes the item report an account under another id, with its lines.
func (s *Server) ChangeAccountID(accountID, id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.eachAccount(accountID, func(a *client.Account) { a.ID = id })
	s.transactions[id] = s.transactions[accountID]
	delete(s.transactions, accountID)
}

// ChangeReservedIdentification makes the item report a reserved balance under another
// identification.
func (s *Server) ChangeReservedIdentification(accountID, identification, id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.eachAccount(accountID, func(a *client.Account) {
		for i := range a.BankData.ReservedBalances {
			if r := &a.BankData.ReservedBalances[i]; r.Identification == identification {
				r.Identification = id
			}
		}
	})
}

// SetAccountBalance changes an account's balance.
func (s *Server) SetAccountBalance(accountID string, balance client.Decimal) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for item, as := range s.accounts {
		for i := range as {
			if as[i].ID == accountID {
				s.accounts[item][i].Balance = balance
			}
		}
	}
}

// AddReservedBalance adds a reserved balance to a bank account.
func (s *Server) AddReservedBalance(accountID string, r client.ReservedBalance) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.eachAccount(accountID, func(a *client.Account) {
		if a.BankData == nil {
			a.BankData = &client.BankData{}
		}

		a.BankData.ReservedBalances = append(a.BankData.ReservedBalances, r)
	})
}

// SetReservedAmount changes the first amount of a reserved balance.
func (s *Server) SetReservedAmount(accountID, identification string, amount client.Decimal) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.eachAccount(accountID, func(a *client.Account) {
		if a.BankData == nil {
			return
		}

		for i := range a.BankData.ReservedBalances {
			if r := &a.BankData.ReservedBalances[i]; r.Identification == identification && len(r.AvailableAmounts) > 0 {
				r.AvailableAmounts[0].Amount = amount
			}
		}
	})
}

// RenameReservedBalance changes the name of a reserved balance, as when the owner renames it.
func (s *Server) RenameReservedBalance(accountID, identification, name string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.eachAccount(accountID, func(a *client.Account) {
		if a.BankData == nil {
			return
		}

		for i := range a.BankData.ReservedBalances {
			if r := &a.BankData.ReservedBalances[i]; r.Identification == identification {
				r.Name = name
			}
		}
	})
}

// RemoveReservedBalance stops reporting a reserved balance, as when the owner deletes it.
func (s *Server) RemoveReservedBalance(accountID, identification string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.eachAccount(accountID, func(a *client.Account) {
		if a.BankData != nil {
			a.BankData.ReservedBalances = slices.DeleteFunc(a.BankData.ReservedBalances, func(r client.ReservedBalance) bool { return r.Identification == identification })
		}
	})
}

// SetItemUpdatedAt changes the instant an item reports as its last update.
func (s *Server) SetItemUpdatedAt(itemID, at string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if it, ok := s.items[itemID]; ok {
		it.LastUpdatedAt = &at
		s.items[itemID] = it
	}
}

// SetItemNextAutoSync changes the instant an item reports for its next automatic update.
func (s *Server) SetItemNextAutoSync(itemID, at string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if it, ok := s.items[itemID]; ok {
		it.NextAutoSyncAt = &at
		s.items[itemID] = it
	}
}

// SetItemConsentExpiresAt changes the consent expiry an item reports.
func (s *Server) SetItemConsentExpiresAt(itemID, at string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if it, ok := s.items[itemID]; ok {
		it.ConsentExpiresAt = &at
		s.items[itemID] = it
	}
}

// SetAccountTaxNumber makes the account report n as its holder's document.
func (s *Server) SetAccountTaxNumber(accountID, n string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.eachAccount(accountID, func(a *client.Account) { a.TaxNumber = n })
}

func (s *Server) AddBill(accountID string, b client.Bill) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.bills[accountID] = append(s.bills[accountID], b)
}

// AddTransaction adds a transaction, or replaces the one with the same id.
func (s *Server) AddTransaction(accountID string, t client.Transaction) {
	s.mu.Lock()
	defer s.mu.Unlock()

	ts := s.transactions[accountID]
	if i := slices.IndexFunc(ts, func(x client.Transaction) bool { return x.ID == t.ID }); i >= 0 {
		ts[i] = t
		return
	}

	s.transactions[accountID] = append(ts, t)
}

// RemoveTransaction stops returning a transaction, as banks sometimes do.
func (s *Server) RemoveTransaction(accountID, id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.transactions[accountID] = slices.DeleteFunc(s.transactions[accountID], func(x client.Transaction) bool { return x.ID == id })
}

// FailNext answers the next n requests with status; 429 carries Retry-After: 7.
func (s *Server) FailNext(status, n int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.failStatus, s.failCount = status, n
}

// FailTransactions answers the transaction requests of an account with status until it is
// called again with 0.
func (s *Server) FailTransactions(accountID string, status int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.failing[accountID] = status
}

// RevokeKeys invalidates every API key issued so far.
func (s *Server) RevokeKeys() {
	s.mu.Lock()
	defer s.mu.Unlock()

	clear(s.keys)
}

// SetNext makes the first transaction page return next as its cursor.
func (s *Server) SetNext(next string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.next = next
}

func (s *Server) eachAccount(accountID string, fn func(*client.Account)) {
	for _, as := range s.accounts {
		for i := range as {
			if as[i].ID == accountID {
				fn(&as[i])
			}
		}
	}
}
