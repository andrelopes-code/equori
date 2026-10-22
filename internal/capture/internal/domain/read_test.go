package domain

import (
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/platform/money"
)

var (
	checking  = uuid.MustParse("00000000-0000-7000-8000-000000000001")
	visa      = uuid.MustParse("00000000-0000-7000-8000-000000000002")
	wallet    = uuid.MustParse("00000000-0000-7000-8000-000000000003")
	reserve   = uuid.MustParse("00000000-0000-7000-8000-000000000004")
	wise      = uuid.MustParse("00000000-0000-7000-8000-000000000005")
	nubankCC  = uuid.MustParse("00000000-0000-7000-8000-000000000006")
	interAcct = uuid.MustParse("00000000-0000-7000-8000-000000000007")
)

func vocabulary(extra ...Account) Vocabulary {
	return Vocabulary{Base: "BRL", Lexicon: Merge(Portuguese(), English()), Accounts: append([]Account{
		{ID: checking, Class: "asset", Kind: "checking", Currency: "BRL", Handles: []string{"Nubank checking", "Nubank"}},
		{ID: visa, Class: "liability", Kind: "credit_card", Currency: "BRL", Handles: []string{"Itaú Visa", "Itaú", "final 1234", "*1234"}},
		{ID: wallet, Class: "asset", Kind: "cash", Currency: "BRL", Handles: []string{"Wallet"}},
		{ID: reserve, Class: "asset", Kind: "reserve", Currency: "BRL", Handles: []string{"Emergency fund"}},
		{ID: wise, Class: "asset", Kind: "checking", Currency: "USD", Handles: []string{"Wise USD"}},
	}, extra...)}
}

// draft is the part of a Line a case asserts; Issues lists codes only.
type draft struct {
	Kind         Kind
	Amount       int64
	Date         string
	Account      uuid.UUID
	Source       Source
	To           uuid.UUID
	Installments int
	Description  string
	Tags         []string
	Issues       []IssueCode
}

func draftOf(l Line) draft {
	d := draft{
		Kind: l.Kind, Amount: l.Amount, Date: l.Date.Format(time.DateOnly), Account: l.AccountID, Source: l.AccountSource,
		To: l.ToAccountID, Installments: l.Installments, Description: l.Description, Tags: l.Tags,
	}
	for _, i := range l.Issues {
		d.Issues = append(d.Issues, i.Code)
	}
	return d
}

func TestRead(t *testing.T) {
	t.Parallel()
	today := "2026-10-21"
	for _, c := range []struct {
		name, text string
		def        uuid.UUID
		want       draft
	}{
		{"S99", "ontem mercado 230 nubank checking", uuid.Nil,
			draft{Kind: KindExpense, Amount: 23000, Date: "2026-10-20", Account: checking, Source: SourceText, Description: "Mercado"}},
		{"S100 card by final digits", "ifood 58 3x final 1234", uuid.Nil,
			draft{Kind: KindExpense, Amount: 5800, Date: today, Account: visa, Source: SourceText, Installments: 3, Description: "Ifood"}},
		{"S100 institution", "uber 32,50 itaú", uuid.Nil,
			draft{Kind: KindExpense, Amount: 3250, Date: today, Account: visa, Source: SourceText, Description: "Uber"}},
		{"S101", "notebook 3x de 1.200 itaú", uuid.Nil,
			draft{Kind: KindExpense, Amount: 360000, Date: today, Account: visa, Source: SourceText, Installments: 3, Description: "Notebook"}},
		{"S102", "transferi 500 do nubank checking pra wallet", uuid.Nil,
			draft{Kind: KindTransfer, Amount: 50000, Date: today, Account: checking, Source: SourceText, To: wallet}},
		{"S103", "recebi 1.5k nubank checking", uuid.Nil,
			draft{Kind: KindIncome, Amount: 150000, Date: today, Account: checking, Source: SourceText}},
		{"S105 without default", "cinema 40", uuid.Nil,
			draft{Kind: KindExpense, Amount: 4000, Date: today, Description: "Cinema", Issues: []IssueCode{IssueMissingAccount}}},
		{"S105 with default", "cinema 40", wallet,
			draft{Kind: KindExpense, Amount: 4000, Date: today, Account: wallet, Source: SourceDefault, Description: "Cinema"}},
		{"S106", "almoço 32 nubank", uuid.Nil,
			draft{Kind: KindExpense, Amount: 3200, Date: today, Account: checking, Source: SourceText, Description: "Almoço"}},
		{"S106 narrowed to nothing", "almoço 32 itaú débito", uuid.Nil,
			draft{Kind: KindExpense, Amount: 3200, Date: today, Description: "Almoço", Issues: []IssueCode{IssueUnknownAccount}}},
		{"S107", "sexta 12,99 wallet", uuid.Nil,
			draft{Kind: KindExpense, Amount: 1299, Date: "2026-10-16", Account: wallet, Source: SourceText}},
		{"S108", "31/02 50 wallet", uuid.Nil,
			draft{Kind: KindExpense, Amount: 5000, Date: today, Account: wallet, Source: SourceText, Issues: []IssueCode{IssueInvalidDate}}},
		{"S109", "mercado 45 3x wallet", uuid.Nil,
			draft{Kind: KindExpense, Amount: 4500, Date: today, Account: wallet, Source: SourceText, Installments: 3, Description: "Mercado", Issues: []IssueCode{IssueInstallmentsNotAllowed}}},
		{"S110", "taxi 30,999 wallet", uuid.Nil,
			draft{Kind: KindExpense, Date: today, Account: wallet, Source: SourceText, Description: "Taxi", Issues: []IssueCode{IssueInvalidAmount}}},
		{"explicit amount leaves other numbers in the description", "padaria 2 irmãos R$15 wallet", uuid.Nil,
			draft{Kind: KindExpense, Amount: 1500, Date: today, Account: wallet, Source: SourceText, Description: "Padaria 2 irmãos"}},
		{"missing amount", "padaria wallet", uuid.Nil,
			draft{Kind: KindExpense, Date: today, Account: wallet, Source: SourceText, Description: "Padaria", Issues: []IssueCode{IssueMissingAmount}}},
		{"two dates", "ontem dia 3 café 8 wallet", uuid.Nil,
			draft{Kind: KindExpense, Amount: 800, Date: today, Account: wallet, Source: SourceText, Description: "Café", Issues: []IssueCode{IssueAmbiguousDate}}},
		{"plus sign is income", "+300 freela wallet", uuid.Nil,
			draft{Kind: KindIncome, Amount: 30000, Date: today, Account: wallet, Source: SourceText, Description: "Freela"}},
		{"destination word alone is a transfer from the default", "200 pra emergency fund", checking,
			draft{Kind: KindTransfer, Amount: 20000, Date: today, Account: checking, Source: SourceDefault, To: reserve}},
		{"transfer word without destination", "transferi 200 nubank", uuid.Nil,
			draft{Kind: KindTransfer, Amount: 20000, Date: today, Account: checking, Source: SourceText, Issues: []IssueCode{IssueMissingDestination}}},
		{"source word decides the direction", "200 wallet do nubank", uuid.Nil,
			draft{Kind: KindTransfer, Amount: 20000, Date: today, Account: checking, Source: SourceText, To: wallet}},
		{"two accounts without direction", "200 wallet nubank", uuid.Nil,
			draft{Kind: KindTransfer, Amount: 20000, Date: today, Issues: []IssueCode{IssueAmbiguousTransfer}}},
		{"three accounts", "200 wallet nubank itaú", uuid.Nil,
			draft{Kind: KindExpense, Amount: 20000, Date: today, Issues: []IssueCode{IssueTooManyAccounts}}},
		{"same account", "transferi 10 de wallet pra wallet", uuid.Nil,
			draft{Kind: KindTransfer, Amount: 1000, Date: today, Account: wallet, Source: SourceText, To: wallet, Issues: []IssueCode{IssueSameAccount}}},
		{"currency mismatch", "100 de wise usd pra nubank", uuid.Nil,
			draft{Kind: KindTransfer, Amount: 10000, Date: today, Account: wise, Source: SourceText, To: checking, Issues: []IssueCode{IssueCurrencyMismatch}}},
		{"tags", "jantar 120 wallet #viagem #Viagem #lazer", uuid.Nil,
			draft{Kind: KindExpense, Amount: 12000, Date: today, Account: wallet, Source: SourceText, Description: "Jantar", Tags: []string{"viagem", "Viagem", "lazer"}}},
		{"method word alone", "uber 30 crédito", uuid.Nil,
			draft{Kind: KindExpense, Amount: 3000, Date: today, Account: visa, Source: SourceText, Description: "Uber"}},
		{"method word takes the default that fits", "uber 30 pix", checking,
			draft{Kind: KindExpense, Amount: 3000, Date: today, Account: checking, Source: SourceDefault, Description: "Uber"}},
		{"installments on income", "recebi 300 3x wallet", uuid.Nil,
			draft{Kind: KindIncome, Amount: 30000, Date: today, Account: wallet, Source: SourceText, Installments: 3, Issues: []IssueCode{IssueInstallmentsNotAllowed}}},
		{"invalid installments", "tv 3000 500x itaú", uuid.Nil,
			draft{Kind: KindExpense, Amount: 300000, Date: today, Account: visa, Source: SourceText, Description: "Tv", Issues: []IssueCode{IssueInvalidInstallments}}},
		{"connectors at the ends", "com o pessoal do trabalho 80 no wallet", uuid.Nil,
			draft{Kind: KindExpense, Amount: 8000, Date: today, Account: wallet, Source: SourceText, Description: "O pessoal do trabalho"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			lines := Read(c.text, vocabulary(), wednesday, c.def)
			if len(lines) != 1 {
				t.Fatalf("lines = %d, want 1", len(lines))
			}
			if got := draftOf(lines[0]); !reflect.DeepEqual(got, c.want) {
				t.Fatalf("got  %+v\nwant %+v", got, c.want)
			}
		})
	}
}

// S104: two numbers without an explicit one give both readings, each with its description.
func TestReadAmbiguousAmount(t *testing.T) {
	t.Parallel()
	l := Read("padaria 2 irmãos 15 wallet", vocabulary(), wednesday, uuid.Nil)[0]
	want := []Issue{{Code: IssueAmbiguousAmount, Field: FieldAmount, Choices: []Choice{
		{Amount: 200, Description: "Padaria irmãos 15", Describes: true},
		{Amount: 1500, Description: "Padaria 2 irmãos", Describes: true},
	}}}
	if !reflect.DeepEqual(l.Issues, want) || l.Amount != 0 {
		t.Fatalf("issues = %+v amount %d", l.Issues, l.Amount)
	}
}

func TestReadAmbiguousAccount(t *testing.T) {
	t.Parallel()
	v := vocabulary(Account{ID: nubankCC, Class: "liability", Kind: "credit_card", Currency: "BRL", Handles: []string{"Nubank card", "Nubank"}})
	for _, c := range []struct {
		text    string
		account uuid.UUID
		issue   *Issue
	}{
		{"uber 30 nubank", uuid.Nil, &Issue{Code: IssueAmbiguousAccount, Field: FieldAccount, Choices: []Choice{{AccountID: checking}, {AccountID: nubankCC}}}},
		{"uber 30 nubank crédito", nubankCC, nil},
		{"uber 30 nubank no cartão", nubankCC, nil},
		{"uber 30 nubank cartão de débito", checking, nil},
		{"uber 30 nubank pix", checking, nil},
	} {
		l := Read(c.text, v, wednesday, uuid.Nil)[0]
		if l.AccountID != c.account {
			t.Errorf("%q: account = %s, want %s", c.text, l.AccountID, c.account)
		}
		if c.issue == nil && len(l.Issues) > 0 || c.issue != nil && !reflect.DeepEqual(l.Issues, []Issue{*c.issue}) {
			t.Errorf("%q: issues = %+v", c.text, l.Issues)
		}
	}
}

func TestReadLinesAndSegments(t *testing.T) {
	t.Parallel()
	lines := Read("uber 32,50 itaú; ifood 58 3x final 1234\n\n  R$ 12 café   #manhã  \n", vocabulary(), wednesday, wallet)
	if len(lines) != 3 || lines[0].Number != 1 || lines[1].Number != 2 || lines[2].Number != 4 {
		t.Fatalf("lines = %+v", lines)
	}
	want := []Segment{
		{"R$ 12", RoleAmount}, {" café   ", RoleText}, {"#manhã", RoleTag},
	}
	if l := lines[2]; !reflect.DeepEqual(l.Segments, want) || l.Text != "R$ 12 café   #manhã" {
		t.Fatalf("segments = %+v of %q", l.Segments, l.Text)
	}
	got := lines[1].Segments
	want = []Segment{
		{"ifood ", RoleText}, {"58", RoleAmount}, {" ", RoleText}, {"3x", RoleInstallments}, {" ", RoleText}, {"final 1234", RoleAccount},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("segments = %+v", got)
	}
	for _, l := range lines {
		var b strings.Builder
		for _, s := range l.Segments {
			b.WriteString(s.Text)
		}
		if b.String() != l.Text {
			t.Errorf("segments of line %d join to %q, want %q", l.Number, b.String(), l.Text)
		}
	}
}

func TestReadUsesTheAccountCurrency(t *testing.T) {
	t.Parallel()
	v := vocabulary(Account{ID: interAcct, Class: "asset", Kind: "checking", Currency: money.Currency("JPY"), Handles: []string{"Tokyo"}})
	l := Read("ramen 1200 tokyo", v, wednesday, uuid.Nil)[0]
	if l.Amount != 1200 || l.Currency != "JPY" {
		t.Fatalf("amount = %d %s", l.Amount, l.Currency)
	}
	if l := Read("ramen 12,5 tokyo", v, wednesday, uuid.Nil)[0]; len(l.Issues) != 1 || l.Issues[0].Code != IssueInvalidAmount {
		t.Fatalf("issues = %+v", l.Issues)
	}
}

// A word one edit away from a handle asks which account it names instead of taking the
// default silently.
func TestReadPossibleAccount(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, text string
		def        uuid.UUID
		account    uuid.UUID
		issues     []Issue
	}{
		{"transposed letters", "almoço 30 nubnak", uuid.Nil, uuid.Nil, []Issue{{Code: IssuePossibleAccount, Field: FieldAccount, Choices: []Choice{
			{AccountID: checking, Description: "Almoço", Describes: true},
		}}}},
		{"default offered beside the near account", "almoço 30 walet", visa, visa, []Issue{{Code: IssuePossibleAccount, Field: FieldAccount, Choices: []Choice{
			{AccountID: wallet, Description: "Almoço", Describes: true},
			{AccountID: visa, Description: "Almoço walet", Describes: true},
		}}}},
		{"source of a transfer to a named account", "transferi 500 nubank pra walet", uuid.Nil, checking, []Issue{{Code: IssuePossibleAccount, Field: FieldToAccount, Choices: []Choice{
			{AccountID: wallet, Describes: true},
		}}}},
		{"a named account leaves near words alone", "almoço 30 nubnak wallet", uuid.Nil, wallet, nil},
		{"short words are never near", "café 30 itaz", uuid.Nil, uuid.Nil, []Issue{{Code: IssueMissingAccount, Field: FieldAccount}}},
		{"two edits are not near", "almoço 30 nubnka", wallet, wallet, nil},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			l := Read(c.text, vocabulary(), wednesday, c.def)[0]
			if l.AccountID != c.account || !reflect.DeepEqual(l.Issues, c.issues) {
				t.Fatalf("account %s issues %+v", l.AccountID, l.Issues)
			}
		})
	}
}

func TestEditDistance(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		a, b string
		want int
	}{
		{"nubank", "nubank", 0}, {"nubnak", "nubank", 1}, {"nubak", "nubank", 1}, {"nubannk", "nubank", 1},
		{"nubamk", "nubank", 1}, {"nubnka", "nubank", 2}, {"carteira", "carreira", 1},
	} {
		if got := editDistance(c.a, c.b); got != c.want {
			t.Errorf("editDistance(%q, %q) = %d, want %d", c.a, c.b, got, c.want)
		}
	}
}
