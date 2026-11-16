package ledger_test

import (
	"net/http"
	"reflect"
	"slices"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"

	"github.com/andrelopes-code/equori/api"
	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type institutionView struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Identifier *struct {
		Scheme     string `json:"scheme"`
		Identifier string `json:"identifier"`
	} `json:"identifier"`
}

// A83: the icon set of the domain is the enum CategoryIcon of the contract.
func TestAccountIconsMatchContract(t *testing.T) {
	t.Parallel()

	doc, err := openapi3.NewLoader().LoadFromData(api.Contract)
	if err != nil {
		t.Fatal(err)
	}

	var want []string
	for _, v := range doc.Components.Schemas["CategoryIcon"].Value.Enum {
		want = append(want, v.(string))
	}

	if !slices.Equal(domain.AccountIcons, want) {
		t.Errorf("AccountIcons = %v, want the enum CategoryIcon %v", domain.AccountIcons, want)
	}
}

// A83: manage_accounts_and_payees sets the colour and the icon of an account on create_account and
// update_account; an omitted one keeps its value, 0 and none clear it.
func TestManageAccountsAppearance(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	create := map[string]any{
		"action": "create_account", "name": "Mercado", "class": "expense", "color": 3,
		"icon": "utensils",
	}

	p := previewTool(t, h, "manage_accounts_and_payees", create)

	got := p.Changes[len(p.Changes)-2:]

	want := []tool.Change{
		{Field: "color", After: tool.TextValue("3")},
		{Field: "icon", After: tool.TextValue("utensils")},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("preview tail = %+v, want %+v", got, want)
	}

	var out manageOut
	toolOutput(t, h, "manage_accounts_and_payees", create, &out)

	account := func() appearanceView {
		var a appearanceView
		h.MustDo(http.MethodGet, "/api/v1/accounts/"+out.ID, nil, http.StatusOK, &a)

		return a
	}

	if a := account(); a.Color == nil || *a.Color != 3 || a.Icon == nil || *a.Icon != "utensils" {
		t.Fatalf("created appearance = %+v, want 3 utensils", a)
	}

	update := map[string]any{"action": "update_account", "account_id": out.ID, "color": 5}

	p = previewTool(t, h, "manage_accounts_and_payees", update)

	wantChanges := []tool.Change{
		{Field: "color", Before: tool.TextValue("3"), After: tool.TextValue("5")},
	}
	if !reflect.DeepEqual(p.Changes, wantChanges) {
		t.Errorf("preview = %+v, want %+v", p.Changes, wantChanges)
	}

	toolOutput(t, h, "manage_accounts_and_payees", update, &manageOut{})

	if a := account(); a.Color == nil || *a.Color != 5 || a.Icon == nil || *a.Icon != "utensils" {
		t.Fatalf("updated appearance = %+v, want 5 utensils", a)
	}

	clear := map[string]any{
		"action": "update_account", "account_id": out.ID, "color": 0, "icon": "none",
	}
	toolOutput(t, h, "manage_accounts_and_payees", clear, &manageOut{})

	if a := account(); a.Color != nil || a.Icon != nil {
		t.Errorf("cleared appearance = %+v, want none", a)
	}
}

// A83: a colour or an icon outside the sets is refused before it changes anything.
func TestManageAccountsAppearanceProblems(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	id := h.Account("Wallet", "asset", "cash", nil)

	tests := []struct {
		name  string
		args  map[string]any
		code  string
		field string
	}{
		{
			"icon on create",
			map[string]any{
				"action": "create_account", "name": "X", "class": "expense", "icon": "bad",
			},
			"invalid_arguments",
			"icon",
		},
		{
			"icon on update",
			map[string]any{"action": "update_account", "account_id": id, "icon": "Bad Icon"},
			"invalid_arguments",
			"icon",
		},
		{
			"colour 9",
			map[string]any{"action": "update_account", "account_id": id, "color": 9},
			"invalid_arguments",
			"color",
		},
		{
			"colour on close",
			map[string]any{"action": "close_account", "account_id": id, "color": 2},
			"invalid_arguments",
			"color",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h.ExpectToolError(
				h.Tool("manage_accounts_and_payees", tt.args),
				tt.code,
				tt.field,
			)
		})
	}

	var a appearanceView
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+id, nil, http.StatusOK, &a)

	if a.Color != nil || a.Icon != nil {
		t.Errorf("appearance = %+v, want none", a)
	}
}

// ADR 013: create_institution takes an identifier and set_institution_identifier sets, replaces
// and clears it.
func TestManageInstitutionIdentifier(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	create := map[string]any{
		"action": "create_institution", "name": "Banco", "scheme": "bic", "identifier": "NUBRBRSP",
	}

	p := previewTool(t, h, "manage_accounts_and_payees", create)

	wantChanges := []tool.Change{
		{Field: "name", After: tool.TextValue("Banco")},
		{Field: "identifier", After: tool.TextValue("bic NUBRBRSP")},
	}
	if !reflect.DeepEqual(p.Changes, wantChanges) {
		t.Errorf("preview = %+v, want %+v", p.Changes, wantChanges)
	}

	var out manageOut
	toolOutput(t, h, "manage_accounts_and_payees", create, &out)

	institution := func() institutionView {
		var list struct {
			Items []institutionView `json:"items"`
		}
		h.MustDo(http.MethodGet, "/api/v1/institutions", nil, http.StatusOK, &list)

		for _, i := range list.Items {
			if i.ID == out.ID {
				return i
			}
		}

		t.Fatalf("institution %s is not listed", out.ID)

		return institutionView{}
	}

	if i := institution(); i.Identifier == nil || i.Identifier.Scheme != "bic" ||
		i.Identifier.Identifier != "NUBRBRSP" {
		t.Fatalf("created identifier = %+v, want bic NUBRBRSP", i.Identifier)
	}

	replace := map[string]any{
		"action": "set_institution_identifier", "institution_id": out.ID, "scheme": "br_ispb",
		"identifier": "18236120",
	}

	p = previewTool(t, h, "manage_accounts_and_payees", replace)

	wantChanges = []tool.Change{{
		Field:  "identifier",
		Before: tool.TextValue("bic NUBRBRSP"),
		After:  tool.TextValue("br_ispb 18236120"),
	}}
	if !reflect.DeepEqual(p.Changes, wantChanges) || p.Target != "Banco" {
		t.Errorf("preview = %+v, want %+v", p, wantChanges)
	}

	toolOutput(t, h, "manage_accounts_and_payees", replace, &manageOut{})

	if i := institution(); i.Identifier == nil || i.Identifier.Scheme != "br_ispb" ||
		i.Identifier.Identifier != "18236120" {
		t.Fatalf("replaced identifier = %+v, want br_ispb 18236120", i.Identifier)
	}

	clear := map[string]any{"action": "set_institution_identifier", "institution_id": out.ID}
	toolOutput(t, h, "manage_accounts_and_payees", clear, &manageOut{})

	if i := institution(); i.Identifier != nil {
		t.Errorf("cleared identifier = %+v, want none", i.Identifier)
	}
}

// ADR 013: an identifier the registry rejects is refused with the schemes it knows.
func TestManageInstitutionIdentifierProblems(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	var inst struct {
		ID string `json:"id"`
	}
	h.MustDo(
		http.MethodPost,
		"/api/v1/institutions",
		map[string]string{"name": "Banco"},
		http.StatusCreated,
		&inst,
	)

	tests := []struct {
		name  string
		args  map[string]any
		code  string
		field string
	}{
		{
			"scheme alone",
			map[string]any{
				"action":         "set_institution_identifier",
				"institution_id": inst.ID,
				"scheme":         "bic",
			},
			"invalid_arguments",
			"identifier",
		},
		{
			"identifier alone",
			map[string]any{
				"action":         "set_institution_identifier",
				"institution_id": inst.ID,
				"identifier":     "1",
			},
			"invalid_arguments",
			"scheme",
		},
		{
			"unknown scheme",
			map[string]any{
				"action": "set_institution_identifier", "institution_id": inst.ID, "scheme": "nope",
				"identifier": "1",
			},
			"invalid_arguments",
			"scheme",
		},
		{
			"pattern",
			map[string]any{
				"action":         "set_institution_identifier",
				"institution_id": inst.ID,
				"scheme":         "br_ispb",
				"identifier":     "12",
			},
			"validation_failed",
			"identifier",
		},
		{
			"without institution",
			map[string]any{
				"action":     "set_institution_identifier",
				"scheme":     "bic",
				"identifier": "NUBRBRSP",
			},
			"invalid_arguments",
			"institution_id",
		},
		{
			"scheme on create_payee",
			map[string]any{"action": "create_payee", "name": "X", "scheme": "bic"},
			"invalid_arguments",
			"scheme",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h.ExpectToolError(
				h.Tool("manage_accounts_and_payees", tt.args),
				tt.code,
				tt.field,
			)
		})
	}
}
