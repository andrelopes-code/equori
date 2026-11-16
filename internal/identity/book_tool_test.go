package identity_test

import (
	"encoding/json"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/andrelopes-code/equori/internal/apitest"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type accessSettings struct {
	Name            string  `json:"name"`
	Region          string  `json:"region"`
	TimeZone        *string `json:"time_zone"`
	DefaultTimeZone string  `json:"default_time_zone"`
}

type accessInvitation struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	ExpiresAt time.Time `json:"expires_at"`
}

type bookAccess struct {
	Name        string             `json:"name"`
	Region      string             `json:"region"`
	TimeZone    string             `json:"time_zone"`
	Members     []memberItem       `json:"members"`
	Invitations []accessInvitation `json:"invitations"`
}

// HA19, HA24: an owner reads the settings, the members and the pending invitations of the book
// through get_book_access; the invitation token is not in the answer.
func TestGetBookAccessTool(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.JoinAs("writer@example.com", h.OwnerID(), "write")
	token := invite(t, h, "guest@example.com", "read")

	r := h.Tool("get_book_access", map[string]any{})
	if r.IsError {
		t.Fatalf("get_book_access = error %s", r.Content)
	}

	if strings.Contains(string(r.Content), token) {
		t.Fatalf("the answer holds the invitation token: %s", r.Content)
	}

	var got bookAccess
	if err := json.Unmarshal(r.Content, &got); err != nil {
		t.Fatal(err)
	}

	var settings accessSettings
	h.MustDo(http.MethodGet, "/api/v1/books/current", nil, http.StatusOK, &settings)

	var invitations struct {
		Items []accessInvitation `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/books/current/invitations", nil, http.StatusOK, &invitations)

	if len(invitations.Items) != 1 || invitations.Items[0].Email != "guest@example.com" {
		t.Fatalf("invitations of the API = %+v", invitations.Items)
	}

	want := bookAccess{
		Name:     settings.Name,
		Region:   settings.Region,
		TimeZone: settings.DefaultTimeZone,
		Members: []memberItem{
			{h.MemberIDOf("owner@example.com"), "owner@example.com", "owner"},
			{h.MemberIDOf("writer@example.com"), "writer@example.com", "write"},
		},
		Invitations: invitations.Items,
	}

	for _, list := range [][]accessInvitation{got.Invitations, want.Invitations} {
		for i := range list {
			list[i].ExpiresAt = list[i].ExpiresAt.UTC().Truncate(time.Second)
		}
	}

	if !reflect.DeepEqual(got, want) {
		t.Errorf("get_book_access = %+v, want %+v", got, want)
	}
}

// HA16: get_book_access needs the owner role.
func TestGetBookAccessToolNeedsOwner(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.JoinAs("writer@example.com", h.OwnerID(), "write")
	h.JoinAs("reader@example.com", h.OwnerID(), "read")

	for _, tt := range []struct {
		email string
		role  auth.BookRole
	}{
		{"writer@example.com", auth.RoleWrite},
		{"reader@example.com", auth.RoleRead},
	} {
		h.ExpectToolError(
			h.ToolAs(tt.email, tt.role, "get_book_access", map[string]any{}),
			"book_role_required",
			"",
		)
	}
}

// HA20, HA21: manage_book changes and removes a membership; the book keeps one owner.
func TestManageBookMembers(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.JoinAs("writer@example.com", h.OwnerID(), "write")
	writerID := h.MemberIDOf("writer@example.com")
	ownerID := h.MemberIDOf("owner@example.com")

	p := previewBook(t, h, map[string]any{
		"action": "change_member_role", "member_id": writerID, "role": "read",
	})

	wantPreview := tool.Preview{
		Action: "manage_book.change_member_role",
		Target: "writer@example.com",
		Changes: []tool.Change{
			{Field: "role", Before: tool.TextValue("write"), After: tool.TextValue("read")},
		},
	}
	if !reflect.DeepEqual(p, wantPreview) {
		t.Errorf("preview = %+v, want %+v", p, wantPreview)
	}

	if got := members(t, h); got[1].Role != "write" {
		t.Fatalf("the preview changed the role: %+v", got)
	}

	r := h.Tool("manage_book", map[string]any{
		"action": "change_member_role", "member_id": writerID, "role": "read",
	})
	if r.IsError {
		t.Fatalf("change_member_role = error %s", r.Content)
	}

	if got := members(t, h); got[1].Role != "read" {
		t.Errorf("role = %q, want read", got[1].Role)
	}

	h.ExpectToolError(
		h.Tool("manage_book", map[string]any{
			"action": "change_member_role", "member_id": ownerID, "role": "write",
		}),
		"last_owner",
		"",
	)
	h.ExpectToolError(
		h.Tool("manage_book", map[string]any{"action": "remove_member", "member_id": ownerID}),
		"last_owner",
		"",
	)
	h.ExpectToolError(
		h.Tool("manage_book", map[string]any{
			"action": "change_member_role", "member_id": 999999, "role": "read",
		}),
		"member_not_found",
		"",
	)

	p = previewBook(t, h, map[string]any{"action": "remove_member", "member_id": writerID})

	wantPreview = tool.Preview{
		Action: "manage_book.remove_member",
		Target: "writer@example.com",
		Changes: []tool.Change{
			{Field: "member", Before: tool.TextValue("writer@example.com")},
		},
		Destructive: true,
	}
	if !reflect.DeepEqual(p, wantPreview) {
		t.Errorf("preview = %+v, want %+v", p, wantPreview)
	}

	if r := h.Tool("manage_book", map[string]any{
		"action": "remove_member", "member_id": writerID,
	}); r.IsError {
		t.Fatalf("remove_member = error %s", r.Content)
	}

	if got := members(t, h); len(got) != 1 || got[0].MemberID != ownerID {
		t.Errorf("members = %+v, want the owner only", got)
	}
}

// HA24: manage_book revokes a pending invitation.
func TestManageBookInvitation(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	invite(t, h, "guest@example.com", "read")

	var list struct {
		Items []accessInvitation `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/books/current/invitations", nil, http.StatusOK, &list)

	id := list.Items[0].ID
	args := map[string]any{"action": "delete_invitation", "invitation_id": id}

	p := previewBook(t, h, args)

	want := tool.Preview{
		Action: "manage_book.delete_invitation",
		Target: "guest@example.com",
		Changes: []tool.Change{
			{Field: "invitation", Before: tool.TextValue("guest@example.com")},
		},
		Destructive: true,
	}
	if !reflect.DeepEqual(p, want) {
		t.Errorf("preview = %+v, want %+v", p, want)
	}

	if r := h.Tool("manage_book", args); r.IsError {
		t.Fatalf("delete_invitation = error %s", r.Content)
	}

	h.MustDo(http.MethodGet, "/api/v1/books/current/invitations", nil, http.StatusOK, &list)

	if len(list.Items) != 0 {
		t.Errorf("invitations = %+v, want none", list.Items)
	}

	h.ExpectToolError(h.Tool("manage_book", args), "invitation_not_found", "")
}

// BK22: manage_book changes the name, the region and the time zone; a field it does not name keeps
// its value, and the time zone default restores the one of the region.
func TestManageBookUpdate(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)

	var before accessSettings
	h.MustDo(http.MethodGet, "/api/v1/books/current", nil, http.StatusOK, &before)

	p := previewBook(t, h, map[string]any{
		"action": "update_book", "name": "Casa", "time_zone": "Europe/Lisbon",
	})

	wantPreview := tool.Preview{
		Action: "manage_book.update_book",
		Target: before.Name,
		Changes: []tool.Change{
			{Field: "name", Before: tool.TextValue(before.Name), After: tool.TextValue("Casa")},
			{
				Field:  "time_zone",
				Before: tool.TextValue(before.DefaultTimeZone),
				After:  tool.TextValue("Europe/Lisbon"),
			},
		},
	}
	if !reflect.DeepEqual(p, wantPreview) {
		t.Errorf("preview = %+v, want %+v", p, wantPreview)
	}

	h.MustDo(http.MethodGet, "/api/v1/books/current", nil, http.StatusOK, &before)

	if before.Name == "Casa" {
		t.Fatal("the preview renamed the book")
	}

	if r := h.Tool("manage_book", map[string]any{
		"action": "update_book", "name": "Casa", "region": "PT", "time_zone": "Europe/Lisbon",
	}); r.IsError {
		t.Fatalf("update_book = error %s", r.Content)
	}

	var got accessSettings
	h.MustDo(http.MethodGet, "/api/v1/books/current", nil, http.StatusOK, &got)

	if got.Name != "Casa" || got.Region != "PT" || got.TimeZone == nil ||
		*got.TimeZone != "Europe/Lisbon" {
		t.Fatalf("settings = %+v, want Casa PT Europe/Lisbon", got)
	}

	if r := h.Tool("manage_book", map[string]any{
		"action": "update_book", "name": "Casa 2",
	}); r.IsError {
		t.Fatalf("update_book name = error %s", r.Content)
	}

	h.MustDo(http.MethodGet, "/api/v1/books/current", nil, http.StatusOK, &got)

	if got.Name != "Casa 2" || got.Region != "PT" || got.TimeZone == nil ||
		*got.TimeZone != "Europe/Lisbon" {
		t.Fatalf("settings = %+v, want Casa 2 PT Europe/Lisbon", got)
	}

	if r := h.Tool("manage_book", map[string]any{
		"action": "update_book", "time_zone": "default",
	}); r.IsError {
		t.Fatalf("update_book default = error %s", r.Content)
	}

	h.MustDo(http.MethodGet, "/api/v1/books/current", nil, http.StatusOK, &got)

	if got.TimeZone != nil {
		t.Errorf("time_zone = %q, want the default of the region", *got.TimeZone)
	}
}

// BK22: manage_book refuses a call it cannot apply, before it changes anything.
func TestManageBookProblems(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.JoinAs("writer@example.com", h.OwnerID(), "write")

	tests := []struct {
		name  string
		args  map[string]any
		code  string
		field string
	}{
		{"no field", map[string]any{"action": "update_book"}, "invalid_arguments", "name"},
		{
			"time zone",
			map[string]any{"action": "update_book", "time_zone": "Nowhere/Land"},
			"time_zone_invalid",
			"",
		},
		{
			"region",
			map[string]any{"action": "update_book", "region": "BRA"},
			"validation_failed",
			"region",
		},
		{
			"name",
			map[string]any{"action": "update_book", "name": strings.Repeat("a", 81)},
			"validation_failed",
			"name",
		},
		{
			"unused field",
			map[string]any{"action": "update_book", "name": "Casa", "member_id": 3},
			"invalid_arguments",
			"member_id",
		},
		{
			"member without id",
			map[string]any{"action": "remove_member"},
			"invalid_arguments",
			"member_id",
		},
		{
			"role without member",
			map[string]any{"action": "change_member_role", "role": "read"},
			"invalid_arguments",
			"member_id",
		},
		{
			"invitation id",
			map[string]any{"action": "delete_invitation", "invitation_id": "x"},
			"invalid_arguments",
			"invitation_id",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h.ExpectToolError(h.Tool("manage_book", tt.args), tt.code, tt.field)
		})
	}

	if got := members(t, h); len(got) != 2 {
		t.Errorf("members = %+v, want 2", got)
	}
}

// S192, HA16: manage_book needs the owner role; a call or a preview of a write or read member is
// refused and changes nothing.
func TestManageBookNeedsOwner(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	h.JoinAs("writer@example.com", h.OwnerID(), "write")
	h.JoinAs("reader@example.com", h.OwnerID(), "read")
	invite(t, h, "guest@example.com", "read")

	var list struct {
		Items []accessInvitation `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/books/current/invitations", nil, http.StatusOK, &list)

	calls := []map[string]any{
		{"action": "update_book", "name": "Casa"},
		{
			"action":    "change_member_role",
			"member_id": h.MemberIDOf("reader@example.com"),
			"role":      "owner",
		},
		{"action": "remove_member", "member_id": h.MemberIDOf("reader@example.com")},
		{"action": "delete_invitation", "invitation_id": list.Items[0].ID},
	}

	for _, who := range []struct {
		email string
		role  auth.BookRole
	}{
		{"writer@example.com", auth.RoleWrite},
		{"reader@example.com", auth.RoleRead},
	} {
		for _, args := range calls {
			h.ExpectToolError(
				h.ToolAs(who.email, who.role, "manage_book", args),
				"book_role_required",
				"",
			)

			b, err := json.Marshal(args)
			if err != nil {
				t.Fatal(err)
			}

			_, r, err := h.App.Tools.Preview(h.WithIdentity(who.email, who.role), "manage_book", b)
			if err != nil || !r.IsError ||
				!strings.Contains(string(r.Content), "book_role_required") {
				t.Fatalf("preview as %s = %v, %s", who.role, err, r.Content)
			}
		}
	}

	if got := members(t, h); len(got) != 3 || got[2].Role != "read" {
		t.Errorf("members = %+v, want the three members with their roles", got)
	}

	var settings accessSettings
	h.MustDo(http.MethodGet, "/api/v1/books/current", nil, http.StatusOK, &settings)

	if settings.Name == "Casa" {
		t.Error("a member below owner renamed the book")
	}
}

func previewBook(t *testing.T, h *apitest.Harness, args map[string]any) tool.Preview {
	t.Helper()

	b, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}

	p, r, err := h.App.Tools.Preview(
		h.WithIdentity("owner@example.com", auth.RoleOwner),
		"manage_book",
		b,
	)
	if err != nil || r.IsError {
		t.Fatalf("preview = %v, %s", err, r.Content)
	}

	return p
}

func members(t *testing.T, h *apitest.Harness) []memberItem {
	t.Helper()

	var list struct {
		Items []memberItem `json:"items"`
	}
	h.MustDo(http.MethodGet, "/api/v1/books/current/members", nil, http.StatusOK, &list)

	return list.Items
}
