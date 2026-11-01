package identity_test

import (
	"net/http"
	"net/http/cookiejar"
	"testing"

	"github.com/andrelopes-code/equori/internal/apitest"
)

type accountInvitationBody struct {
	Email        string `json:"email"`
	Region       string `json:"region"`
	BaseCurrency string `json:"base_currency"`
	Token        string `json:"token"`
}

// An admin creates an account with a link: the new member gets a book of its own, not the admin's.
func TestAdminCreatesAccount(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	var created accountInvitationBody

	r := h.Do(http.MethodPost, "/api/v1/account-invitations", map[string]string{"email": "Sister@Example.com", "region": "BR"})
	expectStatus(t, r, http.StatusCreated)
	r.Decode(t, &created)

	if created.Email != "sister@example.com" || created.Region != "BR" || created.BaseCurrency != "BRL" || created.Token == "" {
		t.Fatalf("created = %+v", created)
	}

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}

	anon := &http.Client{Jar: jar}

	var preview struct {
		Kind         string `json:"kind"`
		Email        string `json:"email"`
		InviterEmail string `json:"inviter_email"`
		MemberExists bool   `json:"member_exists"`
	}

	r = h.Call(anon, http.MethodPost, "/api/v1/invitations/preview", map[string]string{"token": created.Token})
	expectStatus(t, r, http.StatusOK)
	r.Decode(t, &preview)

	if want := (struct {
		Kind         string `json:"kind"`
		Email        string `json:"email"`
		InviterEmail string `json:"inviter_email"`
		MemberExists bool   `json:"member_exists"`
	}{"account", "sister@example.com", "owner@example.com", false}); preview != want {
		t.Fatalf("preview = %+v, want %+v", preview, want)
	}

	accept := "/api/v1/invitations/accept"
	h.ExpectProblem(
		h.Call(anon, http.MethodPost, accept, map[string]string{"token": created.Token, "password": "short", "language": "pt"}),
		http.StatusUnprocessableEntity, "validation_failed", "password",
	)

	r = h.Call(anon, http.MethodPost, accept, map[string]string{"token": created.Token, "password": apitest.Password, "language": "pt"})
	expectStatus(t, r, http.StatusNoContent)

	var me struct {
		Role     string `json:"role"`
		Language string `json:"language"`
		BooksID  int64  `json:"books_id"`
		BookRole string `json:"book_role"`
	}

	r = h.Call(anon, http.MethodGet, "/api/v1/me", nil)
	expectStatus(t, r, http.StatusOK)
	r.Decode(t, &me)

	if me.Role != "member" || me.Language != "pt" || me.BookRole != "owner" || me.BooksID == h.OwnerID() {
		t.Fatalf("me = %+v, want a member owning a book other than %d", me, h.OwnerID())
	}

	h.ExpectProblem(h.Call(anon, http.MethodPost, accept, map[string]string{"token": created.Token}), http.StatusNotFound, "invitation_not_found", "")
}

func TestAccountInvitationRefusesAMember(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	member := h.LoginMember("bob@example.com")

	h.ExpectProblem(
		h.Call(member, http.MethodPost, "/api/v1/account-invitations", map[string]string{"email": "x@example.com", "region": "BR"}),
		http.StatusForbidden, "admin_required", "",
	)
}

func TestAccountInvitationRefusesAnExistingEmail(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.LoginMember("bob@example.com")

	h.ExpectProblem(
		h.Do(http.MethodPost, "/api/v1/account-invitations", map[string]string{"email": "bob@example.com", "region": "BR"}),
		http.StatusConflict, "email_taken", "",
	)
}

func TestAccountInvitationValidatesItsFields(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	path := "/api/v1/account-invitations"
	h.ExpectProblem(h.Do(http.MethodPost, path, map[string]string{"email": "not-an-email", "region": "BR"}), http.StatusUnprocessableEntity, "validation_failed", "email")
	h.ExpectProblem(h.Do(http.MethodPost, path, map[string]string{"email": "x@example.com", "region": "ZZ"}), http.StatusUnprocessableEntity, "validation_failed", "region")
	h.ExpectProblem(h.Do(http.MethodPost, path, map[string]string{"email": "x@example.com", "region": "PT"}), http.StatusUnprocessableEntity, "validation_failed", "base_currency")
}
