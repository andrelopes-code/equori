package ingestion_test

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/apitest"
	pluggy "github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client"
	"github.com/andrelopes-code/equori/internal/ingestion/internal/aggregator/pluggy/client/pluggytest"
)

const (
	pluggyClient   = "client-1f0c"
	pluggySecret   = "secret-8d2e41"
	nubankItem     = "item-nubank-7f3a91"
	checkingNumber = "0001/12345678-9"
)

type integrationView struct {
	ID         string `json:"id"`
	Aggregator string `json:"aggregator"`
	Name       string `json:"name"`
	UpdatedAt  string `json:"updated_at"`
}

type externalAccountView struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Subtype     string `json:"subtype"`
	Name        string `json:"name"`
	NumberLast4 string `json:"number_last4"`
	Currency    string `json:"currency"`
	State       string `json:"state"`
	AccountID   string `json:"account_id"`
	SyncFrom    string `json:"sync_from"`
}

type connectionView struct {
	ID               string                `json:"id"`
	IntegrationID    string                `json:"integration_id"`
	ExternalID       string                `json:"external_id"`
	State            string                `json:"state"`
	Name             string                `json:"name"`
	ProviderStatus   string                `json:"provider_status"`
	LastItemUpdateAt string                `json:"last_item_update_at"`
	NextItemUpdateAt string                `json:"next_item_update_at"`
	LastSyncedAt     string                `json:"last_synced_at"`
	LastError        string                `json:"last_error"`
	Accounts         []externalAccountView `json:"accounts"`
}

type aggregator struct {
	h *apitest.Harness
	p *pluggytest.Server
}

func newAggregator(t *testing.T) aggregator {
	p := pluggytest.New(t, pluggyClient, pluggySecret)
	return aggregator{h: apitest.New(t, apitest.Today("2026-11-12"), apitest.Aggregator("pluggy", p.URL())), p: p}
}

// serveItem adds an item with a checking account, a credit card and a savings account.
func (a aggregator) serveItem(clientID, itemID, connector string) {
	it := pluggy.Item{ID: itemID, Status: pluggy.StatusUpdated, LastUpdatedAt: new("2026-11-12T06:00:00.000Z")}
	it.Connector.Name = connector
	a.p.AddItemTo(clientID, it)
	a.p.AddAccount(itemID, pluggy.Account{ID: itemID + "-checking", Type: "BANK", Subtype: pluggy.SubtypeChecking, Name: "Conta Corrente", Number: checkingNumber, Balance: "2834.10", CurrencyCode: "BRL"})
	a.p.AddAccount(itemID, pluggy.Account{ID: itemID + "-card", Type: pluggy.TypeCredit, Subtype: pluggy.SubtypeCard, Name: "Ultravioleta", Number: "5162********4321", Balance: "0", CurrencyCode: "BRL"})
	a.p.AddAccount(itemID, pluggy.Account{ID: itemID + "-savings", Type: "BANK", Subtype: pluggy.SubtypeSavings, Name: "Caixinha", Number: "98765432", Balance: "100", CurrencyCode: "BRL"})
}

func integrationBody(name, clientID, secret string) map[string]any {
	return map[string]any{"aggregator": "pluggy", "name": name, "credentials": map[string]any{"client_id": clientID, "client_secret": secret}}
}

func (a aggregator) integrate(c *http.Client, name, clientID, secret string) integrationView {
	a.h.T().Helper()
	r := a.h.Call(c, http.MethodPost, "/api/v1/integrations", integrationBody(name, clientID, secret))
	if r.Status != http.StatusCreated {
		a.h.T().Fatalf("create integration status %d: %s", r.Status, r.Body)
	}
	var out integrationView
	r.Decode(a.h.T(), &out)
	return out
}

func (a aggregator) connect(c *http.Client, integrationID, itemID string) apitest.Response {
	a.h.T().Helper()
	return a.h.Call(c, http.MethodPost, "/api/v1/connections", map[string]any{"integration_id": integrationID, "external_id": itemID})
}

func (a aggregator) mustConnect(c *http.Client, integrationID, itemID string) connectionView {
	a.h.T().Helper()
	r := a.connect(c, integrationID, itemID)
	if r.Status != http.StatusCreated {
		a.h.T().Fatalf("create connection status %d: %s", r.Status, r.Body)
	}
	var out connectionView
	r.Decode(a.h.T(), &out)
	return out
}

func (a aggregator) connection(c *http.Client, id string) connectionView {
	a.h.T().Helper()
	r := a.h.Call(c, http.MethodGet, "/api/v1/connections/"+id, nil)
	if r.Status != http.StatusOK {
		a.h.T().Fatalf("get connection status %d: %s", r.Status, r.Body)
	}
	var out connectionView
	r.Decode(a.h.T(), &out)
	return out
}

func (a aggregator) mapAccount(c *http.Client, connectionID, externalID string, body map[string]any) apitest.Response {
	a.h.T().Helper()
	return a.h.Call(c, http.MethodPut, "/api/v1/connections/"+connectionID+"/accounts/"+externalID, body)
}

func externalAccount(c connectionView, subtype string) externalAccountView {
	for _, x := range c.Accounts {
		if x.Subtype == subtype {
			return x
		}
	}
	return externalAccountView{}
}

// assertNoSecrets checks the test's log for values that must never be logged (A44, N16).
func assertNoSecrets(t *testing.T, h *apitest.Harness, values ...string) {
	t.Helper()
	logs := h.Logs()
	if !strings.Contains(logs, "/api/v1/integrations") {
		t.Fatalf("log capture holds no request: %q", logs)
	}
	for _, v := range append(values, pluggySecret, nubankItem, "12345678", "key-1") {
		if strings.Contains(logs, v) {
			t.Errorf("log contains %q", v)
		}
	}
}

// S51: credentials validated by Pluggy, item Nubank added, two accounts mapped and one ignored.
func TestConnectItemAndMapAccounts(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	a.serveItem(pluggyClient, nubankItem, "Nubank")
	checking := a.h.Account("Nubank checking", "asset", "checking", nil)
	visa := a.h.Card("Itaú Visa", 3, 10, "next")

	r := a.h.Do(http.MethodPost, "/api/v1/integrations", integrationBody("Meu Pluggy", pluggyClient, pluggySecret))
	if r.Status != http.StatusCreated {
		t.Fatalf("create integration status %d: %s", r.Status, r.Body)
	}
	var in integrationView
	r.Decode(t, &in)
	if r.Header.Get("Location") != "/api/v1/integrations/"+in.ID || in.Aggregator != "pluggy" || in.Name != "Meu Pluggy" || in.UpdatedAt == "" {
		t.Fatalf("integration = %+v, location %q", in, r.Header.Get("Location"))
	}
	if bytes.Contains(r.Body, []byte(pluggySecret)) || bytes.Contains(r.Body, []byte(pluggyClient)) {
		t.Fatalf("response carries the credentials: %s", r.Body)
	}
	// N15: the stored value holds neither credential in clear.
	var sealed []byte
	if err := a.h.Pool.QueryRow(t.Context(), `SELECT credential_ciphertext FROM ingestion_integration WHERE id = $1`, in.ID).Scan(&sealed); err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte(pluggySecret)) || bytes.Contains(sealed, []byte(pluggyClient)) {
		t.Fatal("credentials stored in clear")
	}

	r = a.connect(a.h.Client, in.ID, nubankItem)
	if r.Status != http.StatusCreated {
		t.Fatalf("create connection status %d: %s", r.Status, r.Body)
	}
	var conn connectionView
	r.Decode(t, &conn)
	if r.Header.Get("Location") != "/api/v1/connections/"+conn.ID || conn.IntegrationID != in.ID || conn.ExternalID != nubankItem ||
		conn.Name != "Nubank" || conn.ProviderStatus != "UPDATED" || conn.State != "ok" || conn.LastItemUpdateAt != "2026-11-12T06:00:00Z" || len(conn.Accounts) != 3 {
		t.Fatalf("connection = %+v", conn)
	}
	ext := externalAccount(conn, pluggy.SubtypeChecking)
	want := externalAccountView{ID: ext.ID, Type: "BANK", Subtype: pluggy.SubtypeChecking, Name: "Conta Corrente", NumberLast4: "6789", Currency: "BRL", State: "pending"}
	if ext != want {
		t.Fatalf("checking = %+v, want %+v", ext, want)
	}
	if card := externalAccount(conn, pluggy.SubtypeCard); card.NumberLast4 != "4321" || card.Type != pluggy.TypeCredit || card.State != "pending" {
		t.Fatalf("card = %+v", card)
	}

	r = a.mapAccount(a.h.Client, conn.ID, ext.ID, map[string]any{"account_id": checking, "sync_from": "2026-10-01"})
	if r.Status != http.StatusOK {
		t.Fatalf("map checking status %d: %s", r.Status, r.Body)
	}
	var mapped externalAccountView
	r.Decode(t, &mapped)
	want.State, want.AccountID, want.SyncFrom = "mapped", checking, "2026-10-01"
	if mapped != want {
		t.Fatalf("mapped = %+v, want %+v", mapped, want)
	}
	if r := a.mapAccount(a.h.Client, conn.ID, externalAccount(conn, pluggy.SubtypeCard).ID, map[string]any{"account_id": visa, "sync_from": "2026-10-01"}); r.Status != http.StatusOK {
		t.Fatalf("map card status %d: %s", r.Status, r.Body)
	}
	if r := a.mapAccount(a.h.Client, conn.ID, externalAccount(conn, pluggy.SubtypeSavings).ID, map[string]any{"ignored": true}); r.Status != http.StatusOK {
		t.Fatalf("ignore savings status %d: %s", r.Status, r.Body)
	}

	got := a.connection(a.h.Client, conn.ID)
	states := map[string]string{}
	for _, x := range got.Accounts {
		states[x.Subtype] = x.State + " " + x.AccountID
	}
	if states[pluggy.SubtypeChecking] != "mapped "+checking || states[pluggy.SubtypeCard] != "mapped "+visa || states[pluggy.SubtypeSavings] != "ignored " {
		t.Fatalf("states = %v", states)
	}
	var list struct {
		Items []connectionView `json:"items"`
	}
	a.h.MustDo(http.MethodGet, "/api/v1/connections", nil, http.StatusOK, &list)
	if len(list.Items) != 1 || list.Items[0].ID != conn.ID || len(list.Items[0].Accounts) != 3 {
		t.Fatalf("connections = %+v", list.Items)
	}
	var integrations struct {
		Items []integrationView `json:"items"`
	}
	a.h.MustDo(http.MethodGet, "/api/v1/integrations", nil, http.StatusOK, &integrations)
	if len(integrations.Items) != 1 || integrations.Items[0] != in {
		t.Fatalf("integrations = %+v, want %+v", integrations.Items, in)
	}
	var one integrationView
	a.h.MustDo(http.MethodGet, "/api/v1/integrations/"+in.ID, nil, http.StatusOK, &one)
	if one != in {
		t.Fatalf("integration = %+v, want %+v", one, in)
	}
	assertNoSecrets(t, a.h)
}

// A35: an external account maps to one leaf balance account of its currency and a compatible kind.
func TestMapAccountRejections(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	a.serveItem(pluggyClient, nubankItem, "Nubank")
	a.serveItem(pluggyClient, "item-inter-52c8", "Inter")
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	conn := a.mustConnect(a.h.Client, in.ID, nubankItem)
	inter := a.mustConnect(a.h.Client, in.ID, "item-inter-52c8")

	checking := a.h.Account("Nubank checking", "asset", "checking", nil)
	usd := a.h.Account("Wise", "asset", "checking", map[string]any{"currency": "USD"})
	visa := a.h.Card("Itaú Visa", 3, 10, "next")
	food := a.h.Account("Food", "expense", "", nil)
	var institution struct {
		ID string `json:"id"`
	}
	a.h.MustDo(http.MethodPost, "/api/v1/institutions", map[string]string{"name": "Nubank"}, http.StatusCreated, &institution)
	parent := a.h.Account("Nubank", "asset", "checking", map[string]any{"institution_id": institution.ID})
	a.h.Account("Nubank reserve", "asset", "reserve", map[string]any{"institution_id": institution.ID, "parent_id": parent})
	reserve := a.h.Account("Emergency fund", "asset", "reserve", nil)

	ext := externalAccount(conn, pluggy.SubtypeChecking).ID
	for _, tc := range []struct {
		name  string
		body  map[string]any
		field string
	}{
		{"other currency", map[string]any{"account_id": usd, "sync_from": "2026-10-01"}, "account_id"},
		{"incompatible kind", map[string]any{"account_id": visa, "sync_from": "2026-10-01"}, "account_id"},
		{"parent account", map[string]any{"account_id": parent, "sync_from": "2026-10-01"}, "account_id"},
		{"category", map[string]any{"account_id": food, "sync_from": "2026-10-01"}, "account_id"},
		{"unknown account", map[string]any{"account_id": uuid.NewString(), "sync_from": "2026-10-01"}, "account_id"},
		{"no start date", map[string]any{"account_id": checking}, "sync_from"},
		{"mapped and ignored", map[string]any{"account_id": checking, "sync_from": "2026-10-01", "ignored": true}, "ignored"},
		{"neither", map[string]any{}, "account_id"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a.h.ExpectProblem(a.mapAccount(a.h.Client, conn.ID, ext, tc.body), http.StatusUnprocessableEntity, "validation_failed", tc.field)
		})
	}
	if got := externalAccount(a.connection(a.h.Client, conn.ID), pluggy.SubtypeChecking); got.State != "pending" {
		t.Fatalf("rejected mappings changed the account: %+v", got)
	}

	if r := a.mapAccount(a.h.Client, conn.ID, externalAccount(conn, pluggy.SubtypeSavings).ID, map[string]any{"account_id": reserve, "sync_from": "2026-10-01"}); r.Status != http.StatusOK {
		t.Fatalf("savings to reserve status %d: %s", r.Status, r.Body)
	}
	if r := a.mapAccount(a.h.Client, conn.ID, ext, map[string]any{"account_id": checking, "sync_from": "2026-10-01"}); r.Status != http.StatusOK {
		t.Fatalf("map checking status %d: %s", r.Status, r.Body)
	}
	// Two feeds into one account would assert two balances on it.
	a.h.ExpectProblem(a.mapAccount(a.h.Client, inter.ID, externalAccount(inter, pluggy.SubtypeChecking).ID, map[string]any{"account_id": checking, "sync_from": "2026-10-01"}),
		http.StatusUnprocessableEntity, "validation_failed", "account_id")

	a.h.ExpectProblem(a.mapAccount(a.h.Client, conn.ID, uuid.NewString(), map[string]any{"ignored": true}), http.StatusNotFound, "not_found", "")
	a.h.ExpectProblem(a.mapAccount(a.h.Client, conn.ID, externalAccount(inter, pluggy.SubtypeSavings).ID, map[string]any{"ignored": true}), http.StatusNotFound, "not_found", "")
	a.h.ExpectProblem(a.mapAccount(a.h.Client, uuid.NewString(), ext, map[string]any{"ignored": true}), http.StatusNotFound, "not_found", "")
}

// S57 (credential part) and integration_in_use.
func TestIntegrationCredentials(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	a.serveItem(pluggyClient, nubankItem, "Nubank")

	a.h.ExpectProblem(a.h.Do(http.MethodPost, "/api/v1/integrations", integrationBody("Meu Pluggy", pluggyClient, "wrong-secret-77")),
		http.StatusUnprocessableEntity, "aggregator_unauthorized", "client_secret")
	var stored int
	if err := a.h.Pool.QueryRow(t.Context(), `SELECT count(*) FROM ingestion_integration`).Scan(&stored); err != nil || stored != 0 {
		t.Fatalf("stored = %d, %v", stored, err)
	}

	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	a.h.ExpectProblem(a.h.Do(http.MethodPost, "/api/v1/integrations", integrationBody("Meu Pluggy", pluggyClient, pluggySecret)),
		http.StatusUnprocessableEntity, "validation_failed", "name")
	credentials := "/api/v1/integrations/" + in.ID + "/credentials"
	a.h.ExpectProblem(a.h.Do(http.MethodPut, credentials, map[string]any{"client_id": pluggyClient, "client_secret": "wrong-secret-77"}),
		http.StatusUnprocessableEntity, "aggregator_unauthorized", "client_secret")
	conn := a.mustConnect(a.h.Client, in.ID, nubankItem)

	a.p.SetCredentials(pluggyClient, "secret-rotated-19")
	var updated integrationView
	a.h.MustDo(http.MethodPut, credentials, map[string]any{"client_id": pluggyClient, "client_secret": "secret-rotated-19"}, http.StatusOK, &updated)
	if updated.ID != in.ID || updated.Name != in.Name {
		t.Fatalf("updated = %+v", updated)
	}
	a.p.RevokeKeys()
	a.serveItem(pluggyClient, "item-inter-52c8", "Inter")
	inter := a.mustConnect(a.h.Client, in.ID, "item-inter-52c8")
	a.h.ExpectProblem(a.connect(a.h.Client, in.ID, nubankItem), http.StatusUnprocessableEntity, "validation_failed", "external_id")
	a.h.ExpectProblem(a.connect(a.h.Client, in.ID, "item-unknown-0d"), http.StatusUnprocessableEntity, "validation_failed", "external_id")
	a.h.ExpectProblem(a.connect(a.h.Client, uuid.NewString(), nubankItem), http.StatusUnprocessableEntity, "validation_failed", "integration_id")

	path := "/api/v1/integrations/" + in.ID
	a.h.ExpectProblem(a.h.Do(http.MethodDelete, path, nil), http.StatusConflict, "integration_in_use", "")
	for _, c := range []string{conn.ID, inter.ID} {
		a.h.MustDo(http.MethodDelete, "/api/v1/connections/"+c, nil, http.StatusNoContent, nil)
		a.h.ExpectProblem(a.h.Do(http.MethodGet, "/api/v1/connections/"+c, nil), http.StatusNotFound, "not_found", "")
	}
	a.h.MustDo(http.MethodDelete, path, nil, http.StatusNoContent, nil)
	a.h.ExpectProblem(a.h.Do(http.MethodGet, path, nil), http.StatusNotFound, "not_found", "")
	assertNoSecrets(t, a.h, "wrong-secret-77", "secret-rotated-19")
}

func (a aggregator) connections(c *http.Client) []connectionView {
	a.h.T().Helper()
	var out struct {
		Items []connectionView `json:"items"`
	}
	r := a.h.Call(c, http.MethodGet, "/api/v1/connections", nil)
	if r.Status != http.StatusOK {
		a.h.T().Fatalf("list connections status %d: %s", r.Status, r.Body)
	}
	r.Decode(a.h.T(), &out)
	return out.Items
}

// S59 (integration part): each integration keeps its own API key; a wrong secret on one
// leaves the other working.
func TestTwoIntegrations(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	a.p.SetCredentials("client-2b7d", "secret-2c90")
	first := a.integrate(a.h.Client, "Meu Pluggy 1", pluggyClient, pluggySecret)
	second := a.integrate(a.h.Client, "Meu Pluggy 2", "client-2b7d", "secret-2c90")
	for i := range 5 {
		item := fmt.Sprintf("item-first-%d", i)
		a.serveItem(pluggyClient, item, fmt.Sprintf("Bank %d", i))
		a.mustConnect(a.h.Client, first.ID, item)
	}
	for i := range 3 {
		item := fmt.Sprintf("item-second-%d", i)
		a.serveItem("client-2b7d", item, fmt.Sprintf("Bank %d", 5+i))
		a.mustConnect(a.h.Client, second.ID, item)
	}
	if got := a.p.Requests("/auth"); got != 2 {
		t.Fatalf("POST /auth requests = %d, want one per integration", got)
	}
	var page struct {
		Items      []connectionView `json:"items"`
		NextCursor string           `json:"next_cursor"`
	}
	a.h.MustDo(http.MethodGet, "/api/v1/connections?limit=5", nil, http.StatusOK, &page)
	if len(page.Items) != 5 || page.NextCursor == "" {
		t.Fatalf("first page = %d items, cursor %q", len(page.Items), page.NextCursor)
	}
	seen := map[string]bool{}
	for _, c := range page.Items {
		seen[c.ID] = true
	}
	var last struct {
		Items      []connectionView `json:"items"`
		NextCursor string           `json:"next_cursor"`
	}
	a.h.MustDo(http.MethodGet, "/api/v1/connections?limit=5&cursor="+page.NextCursor, nil, http.StatusOK, &last)
	for _, c := range last.Items {
		seen[c.ID] = true
	}
	if len(last.Items) != 3 || last.NextCursor != "" || len(seen) != 8 {
		t.Fatalf("second page = %d items, cursor %q, %d distinct", len(last.Items), last.NextCursor, len(seen))
	}

	a.serveItem("client-2b7d", "item-second-3", "Bank 8")
	a.h.ExpectProblem(a.connect(a.h.Client, first.ID, "item-second-3"), http.StatusUnprocessableEntity, "validation_failed", "external_id")

	a.p.SetCredentials("client-2b7d", "secret-2c91")
	a.p.RevokeKeys()
	a.h.ExpectProblem(a.connect(a.h.Client, second.ID, "item-second-3"), http.StatusUnprocessableEntity, "aggregator_unauthorized", "integration_id")
	a.serveItem(pluggyClient, "item-first-5", "Bank 9")
	a.mustConnect(a.h.Client, first.ID, "item-first-5")
	assertNoSecrets(t, a.h, "secret-2c90", "secret-2c91")
}

// S58 (credentials, connections and mappings): another user sees none of them; the same
// item may be connected by both users (A45).
func TestIntegrationIsolation(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	a.serveItem(pluggyClient, nubankItem, "Nubank")
	checking := a.h.Account("Nubank checking", "asset", "checking", nil)
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	conn := a.mustConnect(a.h.Client, in.ID, nubankItem)
	ext := externalAccount(conn, pluggy.SubtypeChecking).ID

	other := a.h.Login("other@example.com")
	var integrations struct {
		Items []integrationView `json:"items"`
	}
	a.h.Call(other, http.MethodGet, "/api/v1/integrations", nil).Decode(t, &integrations)
	if len(integrations.Items) != 0 || len(a.connections(other)) != 0 {
		t.Fatalf("other sees integrations %+v", integrations.Items)
	}
	for _, r := range []apitest.Response{
		a.h.Call(other, http.MethodGet, "/api/v1/integrations/"+in.ID, nil),
		a.h.Call(other, http.MethodPut, "/api/v1/integrations/"+in.ID+"/credentials", map[string]any{"client_id": pluggyClient, "client_secret": pluggySecret}),
		a.h.Call(other, http.MethodDelete, "/api/v1/integrations/"+in.ID, nil),
		a.h.Call(other, http.MethodGet, "/api/v1/connections/"+conn.ID, nil),
		a.h.Call(other, http.MethodDelete, "/api/v1/connections/"+conn.ID, nil),
		a.mapAccount(other, conn.ID, ext, map[string]any{"ignored": true}),
	} {
		a.h.ExpectProblem(r, http.StatusNotFound, "not_found", "")
	}
	a.h.ExpectProblem(a.connect(other, in.ID, nubankItem), http.StatusUnprocessableEntity, "validation_failed", "integration_id")

	own := a.integrate(other, "Meu Pluggy", pluggyClient, pluggySecret)
	otherConn := a.mustConnect(other, own.ID, nubankItem)
	a.h.ExpectProblem(a.mapAccount(other, otherConn.ID, externalAccount(otherConn, pluggy.SubtypeChecking).ID, map[string]any{"account_id": checking, "sync_from": "2026-10-01"}),
		http.StatusUnprocessableEntity, "validation_failed", "account_id")
	if got := externalAccount(a.connection(a.h.Client, conn.ID), pluggy.SubtypeChecking); got.State != "pending" {
		t.Fatalf("owner's account = %+v", got)
	}
}

// ADR 008 K2: without EQUORI_SECRET_KEY integrations are unavailable.
func TestIntegrationsWithoutKey(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	for _, r := range []apitest.Response{
		h.Do(http.MethodPost, "/api/v1/integrations", integrationBody("Meu Pluggy", pluggyClient, pluggySecret)),
		h.Do(http.MethodGet, "/api/v1/integrations", nil),
		h.Do(http.MethodGet, "/api/v1/connections", nil),
		h.Do(http.MethodPost, "/api/v1/connections", map[string]any{"integration_id": uuid.NewString(), "external_id": nubankItem}),
	} {
		h.ExpectProblem(r, http.StatusConflict, "integration_unavailable", "")
	}
}

// ADR 008 K3: a sealed value copied to another row does not open.
func TestCredentialsBoundToTheirRow(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	a.serveItem(pluggyClient, nubankItem, "Nubank")
	first := a.integrate(a.h.Client, "Meu Pluggy 1", pluggyClient, pluggySecret)
	second := a.integrate(a.h.Client, "Meu Pluggy 2", pluggyClient, pluggySecret)
	if _, err := a.h.Pool.Exec(t.Context(), `UPDATE ingestion_integration SET credential_ciphertext = (SELECT credential_ciphertext FROM ingestion_integration WHERE id = $1) WHERE id = $2`, first.ID, second.ID); err != nil {
		t.Fatal(err)
	}
	a.h.Restart(apitest.Aggregator("pluggy", a.p.URL()))
	a.h.ExpectProblem(a.connect(a.h.Client, second.ID, nubankItem), http.StatusConflict, "integration_unavailable", "")
	a.mustConnect(a.h.Client, first.ID, nubankItem)
}

// ADR 008 K4: rotation reseals every value under the new key.
func TestSecretRotation(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	a.serveItem(pluggyClient, nubankItem, "Nubank")
	a.serveItem(pluggyClient, "item-inter-52c8", "Inter")
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	other := a.h.Login("other@example.com")
	a.integrate(other, "Meu Pluggy", pluggyClient, pluggySecret)

	next := strings.Repeat("n", 32)
	a.h.Restart(apitest.Aggregator("pluggy", a.p.URL()), apitest.SecretKeys(next, apitest.SecretKey))
	for i, want := range []int{2, 0} {
		n, err := a.h.App.Ingestion.RotateSecrets(t.Context())
		if err != nil || n != want {
			t.Fatalf("rotation %d = %d, %v; want %d", i, n, err, want)
		}
	}
	a.h.Restart(apitest.Aggregator("pluggy", a.p.URL()), apitest.SecretKeys(next, ""))
	a.mustConnect(a.h.Client, in.ID, nubankItem)
	a.h.Restart(apitest.Aggregator("pluggy", a.p.URL()))
	a.h.ExpectProblem(a.connect(a.h.Client, in.ID, "item-inter-52c8"), http.StatusConflict, "integration_unavailable", "")
}

// A Pluggy that does not answer is a 502, not an internal error.
func TestAggregatorUnavailable(t *testing.T) {
	t.Parallel()
	closed := httptest.NewServer(http.NotFoundHandler())
	closed.Close()
	h := apitest.New(t, apitest.Aggregator("pluggy", closed.URL))
	h.ExpectProblem(h.Do(http.MethodPost, "/api/v1/integrations", integrationBody("Meu Pluggy", pluggyClient, pluggySecret)),
		http.StatusBadGateway, "aggregator_unavailable", "")
}

// Export design E2: an imported integration holds no credential; rotation passes over it and
// the integration asks for the credential again.
func TestSecretRotationSkipsImportedIntegration(t *testing.T) {
	t.Parallel()
	a := newAggregator(t)
	a.serveItem(pluggyClient, nubankItem, "Nubank")
	in := a.integrate(a.h.Client, "Meu Pluggy", pluggyClient, pluggySecret)
	if _, err := a.h.Pool.Exec(t.Context(), `UPDATE ingestion_integration SET credential_ciphertext = ''`); err != nil {
		t.Fatal(err)
	}
	a.h.Restart(apitest.Aggregator("pluggy", a.p.URL()), apitest.SecretKeys(strings.Repeat("n", 32), apitest.SecretKey))
	if n, err := a.h.App.Ingestion.RotateSecrets(t.Context()); err != nil || n != 0 {
		t.Fatalf("rotation = %d, %v; want 0", n, err)
	}
	a.h.ExpectProblem(a.connect(a.h.Client, in.ID, nubankItem), http.StatusConflict, "integration_unavailable", "")
}
