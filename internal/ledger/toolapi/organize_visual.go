package toolapi

import (
	"context"
	"strconv"
	"strings"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

const noneText = "none"

// appearance returns the colour and the icon the call gives; nil is a field it does not give, and
// 0 or "" clears. The sets are checked here so a preview refuses what the run would refuse.
func (c organizeCall) appearance() (color *int, icon *string, err error) {
	if c.in.Color.Set {
		if c.in.Color.N < 0 || c.in.Color.N > 8 {
			return nil, nil, tool.InvalidArgument("color", "must be 1 to 8, or 0 to clear")
		}

		color = &c.in.Color.N
	}

	if c.in.Icon == "" {
		return color, nil, nil
	}

	key := c.in.Icon
	if key == noneText {
		key = ""
	}

	if domain.ValidateIcon(key) != nil {
		return nil, nil, tool.InvalidArgument(
			"icon",
			"must be none or one of: "+strings.Join(domain.AccountIcons, ", "),
		)
	}

	return color, &key, nil
}

// setAppearance copies the colour and the icon the call gave onto a new account.
func setAppearance(a *domain.Account, color *int, icon *string) {
	if color != nil {
		a.Color = *color
	}

	if icon != nil {
		a.Icon = *icon
	}
}

// newAppearanceChanges lists the colour and the icon a new account gets.
func newAppearanceChanges(color *int, icon *string) []tool.Change {
	var changes []tool.Change

	if color != nil && *color != 0 {
		changes = append(changes, tool.Change{
			Field: "color",
			After: tool.TextValue(strconv.Itoa(*color)),
		})
	}

	if icon != nil && *icon != "" {
		changes = append(changes, tool.Change{Field: "icon", After: tool.TextValue(*icon)})
	}

	return changes
}

// patchAppearance sets the colour and the icon the call gave on the patch and the preview.
func patchAppearance(
	pv *tool.Preview,
	patch *app.AccountPatch,
	a domain.Account,
	color *int,
	icon *string,
) {
	if color != nil {
		patch.Color = color
		pv.Changes = append(pv.Changes, tool.Change{
			Field:  "color",
			Before: tool.TextValue(colorText(a.Color)),
			After:  tool.TextValue(colorText(*color)),
		})
	}

	if icon != nil {
		patch.Icon = icon
		pv.Changes = append(pv.Changes, tool.Change{
			Field:  "icon",
			Before: tool.TextValue(iconText(a.Icon)),
			After:  tool.TextValue(iconText(*icon)),
		})
	}
}

func colorText(n int) string {
	if n == 0 {
		return noneText
	}

	return strconv.Itoa(n)
}

func iconText(key string) string {
	if key == "" {
		return noneText
	}

	return key
}

// institutionIdentifier returns the identifier the call gives: both fields, or none to clear.
func (c organizeCall) institutionIdentifier() (app.InstitutionIdentifier, error) {
	scheme, value := c.in.Scheme, c.in.Identifier

	switch {
	case scheme == "" && value == "":
		return app.InstitutionIdentifier{}, nil
	case scheme == "":
		return app.InstitutionIdentifier{}, tool.InvalidArgument(
			"scheme",
			"is required with identifier",
		)
	case value == "":
		return app.InstitutionIdentifier{}, tool.InvalidArgument(
			"identifier",
			"is required with scheme",
		)
	}

	var known []string

	for _, s := range c.svc.InstitutionIdentifierSchemes() {
		if s.ID == scheme {
			return app.InstitutionIdentifier{
				Scheme: scheme,
				Value:  value,
			}, domain.ValidateIdentifier(
				scheme,
				value,
			)
		}

		known = append(known, s.ID)
	}

	return app.InstitutionIdentifier{}, tool.InvalidArgument(
		"scheme",
		"must be one of: "+strings.Join(known, ", "),
	)
}

func identifierText(i app.InstitutionIdentifier) string {
	if i == (app.InstitutionIdentifier{}) {
		return noneText
	}

	return i.Scheme + " " + i.Value
}

func (c organizeCall) planSetInstitutionIdentifier(
	ctx context.Context,
	pv *tool.Preview,
) (organizeRun, error) {
	if err := c.check([]string{"institution_id"}, "scheme", "identifier"); err != nil {
		return nil, err
	}

	ident, err := c.institutionIdentifier()
	if err != nil {
		return nil, err
	}

	inst, err := institutionByID(ctx, c.svc, c.booksID, c.institutionID)
	if err != nil {
		return nil, err
	}

	pv.Target = inst.Name
	pv.Changes = []tool.Change{{
		Field:  "identifier",
		Before: tool.TextValue(identifierText(inst.Identifier)),
		After:  tool.TextValue(identifierText(ident)),
	}}

	return func() (manageAccountsAndPayeesOut, error) {
		i, err := c.svc.SetInstitutionIdentifier(ctx, c.booksID, inst.ID, ident)

		return manageAccountsAndPayeesOut{Action: c.action, ID: inst.ID.String(), Name: i.Name}, err
	}, nil
}
