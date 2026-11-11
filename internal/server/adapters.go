package server

import (
	"context"
	"encoding/json/v2"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/assistant"
	"github.com/andrelopes-code/equori/internal/ingestion"
	"github.com/andrelopes-code/equori/internal/instance"
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/planning"
	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/secret"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/platform/tool/mcp"
	"github.com/andrelopes-code/equori/internal/reporting"
)

// integrationCredentials is what the export takes from ingestion (export design C2, C6).
type integrationCredentials interface {
	ExportCredentials(ctx context.Context, booksID int64) (map[uuid.UUID]map[string]string, error)
	SealCredentials(
		booksID int64,
		plain map[uuid.UUID]map[string]string,
	) (map[uuid.UUID][]byte, error)
}

// providerKeys is what the export takes from assistant (export design T3, T5).
type providerKeys interface {
	ExportProviderKeys(ctx context.Context, booksID int64) (map[uuid.UUID]string, error)
	SealProviderKeys(booksID int64, keys map[uuid.UUID]string) (map[uuid.UUID][]byte, error)
}

// credentialSource lends the integration credentials and the provider keys to the export of
// reporting. One passphrase seals both in one bundle (export design C3, T3, T4).
type credentialSource struct {
	integrations integrationCredentials
	providers    providerKeys
}

// bundlePlaintext is the plaintext of the archive entry credentials.enc.
type bundlePlaintext struct {
	Credentials  map[uuid.UUID]map[string]string `json:"credentials"`
	ProviderKeys map[uuid.UUID]string            `json:"provider_keys,omitempty"`
}

func (s credentialSource) Bundle(
	ctx context.Context,
	booksID int64,
	passphrase string,
) ([]byte, error) {
	credentials, err := s.integrations.ExportCredentials(ctx, booksID)
	if err != nil {
		return nil, credentialError(err)
	}

	keys, err := s.providers.ExportProviderKeys(ctx, booksID)
	if err != nil {
		return nil, credentialError(err)
	}

	if len(credentials) == 0 && len(keys) == 0 {
		return nil, nil
	}

	plain, err := json.Marshal(bundlePlaintext{Credentials: credentials, ProviderKeys: keys})
	if err != nil {
		return nil, err
	}

	return secret.SealWithPassphrase(plain, passphrase)
}

func (s credentialSource) Reseal(
	booksID int64,
	passphrase string,
	bundle []byte,
) (reporting.SealedCredentials, error) {
	plain, err := secret.OpenWithPassphrase(bundle, passphrase)
	if err != nil {
		return reporting.SealedCredentials{}, reporting.ErrPassphraseInvalid
	}

	var b bundlePlaintext
	if err := json.Unmarshal(plain, &b); err != nil {
		return reporting.SealedCredentials{}, reporting.ErrPassphraseInvalid
	}

	var sealed reporting.SealedCredentials

	sealed.Integrations, err = s.integrations.SealCredentials(booksID, b.Credentials)
	if err != nil {
		return reporting.SealedCredentials{}, credentialError(err)
	}

	if sealed.Providers, err = s.providers.SealProviderKeys(booksID, b.ProviderKeys); err != nil {
		return reporting.SealedCredentials{}, credentialError(err)
	}

	return sealed, nil
}

// linkAdapters hands each module the adapters that join it to another module (ADR 002).
func linkAdapters(m *modules) {
	m.assistant.UseNotices(accountNotices(m.ledger, m.ingestion))
	m.reporting.OnImport(m.portfolio.RebuildBooks)
	m.reporting.UseCredentials(credentialSource{m.ingestion, m.assistant})
	m.reporting.UseIndicatorSources(m.planning, m.portfolio)
	m.assistant.UseSignals(recurringSignals(m.planning))
}

// accountNotices composes the accounts the assistant's prompt names from the ledger's open
// differences and the ingestion feeds (P12 A152, ADR 002).
func accountNotices(
	l *ledger.Module,
	in *ingestion.Module,
) func(context.Context, int64) ([]assistant.AccountNotice, error) {
	return func(ctx context.Context, booksID int64) ([]assistant.AccountNotice, error) {
		checks, err := l.AccountChecks(ctx, booksID)
		if err != nil {
			return nil, err
		}

		ids := make([]uuid.UUID, len(checks))
		for i, c := range checks {
			ids[i] = c.ID
		}

		feeds, err := in.FeedStates(ctx, booksID, ids)
		if err != nil {
			return nil, err
		}

		var out []assistant.AccountNotice
		for _, c := range checks {
			f := feeds[c.ID]
			if f.ConnectionState == "" && c.Difference == nil && f.Unconfirmed == 0 {
				continue
			}

			n := assistant.AccountNotice{
				Name:            c.Name,
				ConnectionState: f.ConnectionState,
				Difference:      c.Difference,
				DifferenceOn:    c.DifferenceOn,
				Unconfirmed:     f.Unconfirmed,
			}
			if f.LastUpdate != nil {
				d := clock.DateOf(*f.LastUpdate, clock.Location(ctx))
				n.LastUpdateOn = &d
			}

			out = append(out, n)
		}

		return out, nil
	}
}

// connections adapts the ingestion read of the diagnostic file to the instance module (ADR 002).
func connections(in *ingestion.Module) func(context.Context) ([]instance.Connection, error) {
	return func(ctx context.Context) ([]instance.Connection, error) {
		list, err := in.ConnectionDiagnostics(ctx)
		if err != nil {
			return nil, err
		}

		out := make([]instance.Connection, len(list))
		for i, c := range list {
			out[i] = instance.Connection{
				ID:         c.ID,
				Aggregator: c.Aggregator,
				State:      c.State,
				LastUpdate: c.LastUpdate,
				Failed:     c.Failed,
			}
		}

		return out, nil
	}
}

// recurringSignals finds the recurring series a proposed purchase joins (spec 2026-11-03 §7).
func recurringSignals(
	m *planning.Module,
) func(context.Context, int64, tool.Preview) ([]assistant.Signal, error) {
	return func(ctx context.Context, booksID int64, p tool.Preview) ([]assistant.Signal, error) {
		if p.Action != "record_transaction" && p.Action != "handle_card_purchase" {
			return nil, nil
		}

		probe := planning.RecurringProbe{}

		for _, c := range p.Changes {
			switch c.Field {
			case "payee":
				probe.Payee = c.After.Text
			case "description":
				probe.Description = c.After.Text
			case "account":
				probe.Account = c.After.Text
			case "amount":
				probe.Amount, probe.Currency = c.After.Amount, c.After.Currency
			case "date":
				d, err := time.Parse("2006-01-02", c.After.Date)
				if err != nil {
					return nil, nil
				}

				probe.Date = d
			}
		}

		series, ok, err := m.RecurringFor(ctx, booksID, probe)
		if err != nil || !ok {
			return nil, err
		}

		return []assistant.Signal{{Kind: "recurring", Data: series}}, nil
	}
}

// mcpPrompts hands the assistant's prompts to the MCP adapter, which knows no module.
func mcpPrompts() []mcp.Prompt {
	var out []mcp.Prompt
	for _, p := range assistant.Prompts() {
		args := make([]mcp.PromptArgument, 0, len(p.Arguments))
		for _, a := range p.Arguments {
			args = append(args, mcp.PromptArgument(a))
		}

		out = append(out, mcp.Prompt{
			Name:        p.Name,
			Description: p.Description,
			Arguments:   args,
			Render:      p.Render,
		})
	}

	return out
}

// credentialError names an error of ingestion or assistant in the terms of reporting.
func credentialError(err error) error {
	if errors.Is(err, ingestion.ErrIntegrationUnavailable) ||
		errors.Is(err, assistant.ErrSecretKeyMissing) {
		return reporting.ErrCredentialsUnavailable
	}

	return err
}
