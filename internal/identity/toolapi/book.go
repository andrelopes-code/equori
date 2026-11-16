package toolapi

import (
	"context"
	"maps"
	"slices"

	"github.com/google/uuid"

	"github.com/andrelopes-code/equori/internal/identity/app"
	"github.com/andrelopes-code/equori/internal/identity/domain"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type manageBookAction string

func (manageBookAction) Values() []string {
	return []string{"update_book", "change_member_role", "remove_member", "delete_invitation"}
}

type bookRole string

func (bookRole) Values() []string { return []string{"read", "write", "owner"} }

type manageBookIn struct {
	Action       manageBookAction `json:"action"                 jsonschema:"operation to propose"`
	Name         string           `json:"name,omitzero"          jsonschema:"for update_book: new name of the book, 1 to 80 characters"`
	Region       string           `json:"region,omitzero"        jsonschema:"for update_book: ISO 3166-1 alpha-2 code of the book's region, such as BR"`
	TimeZone     string           `json:"time_zone,omitzero"     jsonschema:"for update_book: IANA time zone name, or default for the zone of the region"`
	MemberID     int64            `json:"member_id,omitzero"     jsonschema:"for change_member_role and remove_member: member_id from get_book_access"`
	Role         bookRole         `json:"role,omitzero"          jsonschema:"for change_member_role: new role of the member"`
	InvitationID string           `json:"invitation_id,omitzero" jsonschema:"for delete_invitation: id from get_book_access"`
}

type manageBookOut struct {
	Action string `json:"action"`
	Target string `json:"target"`
}

// bookRun applies a planned change; planBook fills the preview of the same change.
type bookRun func() (manageBookOut, error)

func manageBook(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "manage_book",
		Description: "Proposes a change of the book that only its owner makes: rename it or change its region or time zone, change the role of a member, remove a member with its sessions and access tokens, or revoke a pending invitation. " +
			"Use it when the owner asks to change the book's settings or who has access to it; read get_book_access first. " +
			"Do not use it to invite someone or to delete the book: the owner does both in settings. " +
			"The user confirms every change.",
		Effect: tool.Destructive,
		Role:   auth.RoleOwner,
	}, func(ctx context.Context, booksID int64, in manageBookIn) (tool.Preview, error) {
		pv, _, err := planBook(ctx, svc, booksID, in)
		return pv, err
	}, func(ctx context.Context, booksID int64, in manageBookIn) (manageBookOut, error) {
		_, run, err := planBook(ctx, svc, booksID, in)
		if err != nil {
			return manageBookOut{}, err
		}

		return run()
	})
}

func planBook(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageBookIn,
) (tool.Preview, bookRun, error) {
	pv := tool.Preview{Action: "manage_book." + string(in.Action)}

	var (
		run bookRun
		err error
	)

	switch in.Action {
	case "update_book":
		run, err = planUpdateBook(ctx, svc, booksID, in, &pv)
	case "change_member_role":
		run, err = planChangeRole(ctx, svc, booksID, in, &pv)
	case "remove_member":
		run, err = planRemoveMember(ctx, svc, booksID, in, &pv)
	default:
		run, err = planDeleteInvitation(ctx, svc, booksID, in, &pv)
	}

	return pv, run, err
}

func planUpdateBook(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageBookIn,
	pv *tool.Preview,
) (bookRun, error) {
	if err := checkBookFields(in, nil, "name", "region", "time_zone"); err != nil {
		return nil, err
	}

	if in.Name == "" && in.Region == "" && in.TimeZone == "" {
		return nil, tool.InvalidArgument(
			"name",
			"one of name, region or time_zone is required for update_book",
		)
	}

	patch := app.BooksSettingsPatch{
		Name:     optionalText(in.Name),
		Region:   optionalText(in.Region),
		TimeZone: optionalText(in.TimeZone),
	}
	if in.TimeZone == "default" {
		empty := ""
		patch.TimeZone = &empty
	}

	before, after, err := svc.BooksSettingsChange(ctx, booksID, patch)
	if err != nil {
		return nil, err
	}

	pv.Target = before.Name
	pv.Changes = settingsChanges(before, after, in)

	return func() (manageBookOut, error) {
		stored, err := svc.PatchBooksSettings(ctx, booksID, patch)

		return manageBookOut{Action: string(in.Action), Target: stored.Name}, err
	}, nil
}

// settingsChanges lists the settings the call gives; a time zone that moves with the region is listed too.
func settingsChanges(before, after app.BooksSettings, in manageBookIn) []tool.Change {
	var changes []tool.Change

	if in.Name != "" {
		changes = append(changes, textChange("name", before.Name, after.Name))
	}

	if in.Region != "" {
		changes = append(changes, textChange("region", before.Region, after.Region))
	}

	was, now := effectiveTimeZone(before), effectiveTimeZone(after)
	if in.TimeZone != "" || was != now {
		changes = append(changes, textChange("time_zone", was, now))
	}

	return changes
}

func planChangeRole(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageBookIn,
	pv *tool.Preview,
) (bookRun, error) {
	if err := checkBookFields(in, []string{"member_id", "role"}); err != nil {
		return nil, err
	}

	m, err := memberOf(ctx, svc, booksID, in.MemberID)
	if err != nil {
		return nil, err
	}

	pv.Target = m.Email
	pv.Changes = []tool.Change{textChange("role", string(m.Role), string(in.Role))}

	return func() (manageBookOut, error) {
		err := svc.ChangeRole(ctx, booksID, m.MemberID, auth.BookRole(in.Role))

		return manageBookOut{Action: string(in.Action), Target: m.Email}, err
	}, nil
}

func planRemoveMember(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageBookIn,
	pv *tool.Preview,
) (bookRun, error) {
	if err := checkBookFields(in, []string{"member_id"}); err != nil {
		return nil, err
	}

	m, err := memberOf(ctx, svc, booksID, in.MemberID)
	if err != nil {
		return nil, err
	}

	pv.Target, pv.Destructive = m.Email, true
	pv.Changes = []tool.Change{{Field: "member", Before: tool.TextValue(m.Email)}}

	return func() (manageBookOut, error) {
		err := svc.RemoveMembership(ctx, booksID, m.MemberID)

		return manageBookOut{Action: string(in.Action), Target: m.Email}, err
	}, nil
}

func planDeleteInvitation(
	ctx context.Context,
	svc *app.Service,
	booksID int64,
	in manageBookIn,
	pv *tool.Preview,
) (bookRun, error) {
	if err := checkBookFields(in, []string{"invitation_id"}); err != nil {
		return nil, err
	}

	id, err := uuid.Parse(in.InvitationID)
	if err != nil {
		return nil, tool.InvalidArgument("invitation_id", "must be a UUID from get_book_access")
	}

	invitations, err := svc.Invitations(ctx, booksID)
	if err != nil {
		return nil, err
	}

	i := slices.IndexFunc(invitations, func(inv domain.Invitation) bool { return inv.ID == id })
	if i < 0 {
		return nil, app.ErrInvitationNotFound
	}

	email := invitations[i].Email
	pv.Target, pv.Destructive = email, true
	pv.Changes = []tool.Change{{Field: "invitation", Before: tool.TextValue(email)}}

	return func() (manageBookOut, error) {
		err := svc.DeleteInvitation(ctx, booksID, id)

		return manageBookOut{Action: string(in.Action), Target: email}, err
	}, nil
}

func memberOf(
	ctx context.Context,
	svc *app.Service,
	booksID, memberID int64,
) (app.Membership, error) {
	members, err := svc.Members(ctx, booksID)
	if err != nil {
		return app.Membership{}, err
	}

	for _, m := range members {
		if m.MemberID == memberID {
			return m, nil
		}
	}

	return app.Membership{}, app.ErrMemberNotFound
}

// checkBookFields requires the fields an action needs and rejects the ones it does not read.
func checkBookFields(in manageBookIn, required []string, optional ...string) error {
	given := map[string]bool{
		"name":          in.Name != "",
		"region":        in.Region != "",
		"time_zone":     in.TimeZone != "",
		"member_id":     in.MemberID != 0,
		"role":          in.Role != "",
		"invitation_id": in.InvitationID != "",
	}

	for _, f := range required {
		if !given[f] {
			return tool.InvalidArgument(f, "is required for "+string(in.Action))
		}
	}

	used := append(slices.Clone(required), optional...)
	for _, f := range slices.Sorted(maps.Keys(given)) {
		if given[f] && !slices.Contains(used, f) {
			return tool.InvalidArgument(f, "is not used by "+string(in.Action))
		}
	}

	return nil
}

func textChange(field, before, after string) tool.Change {
	return tool.Change{Field: field, Before: tool.TextValue(before), After: tool.TextValue(after)}
}

func optionalText(s string) *string {
	if s == "" {
		return nil
	}

	return &s
}
