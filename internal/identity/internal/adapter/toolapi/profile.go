package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/identity/internal/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type updateProfileIn struct {
	Language string `json:"language,omitzero" jsonschema:"ISO 639 language code, such as en or pt"`
	Region   string `json:"region,omitzero" jsonschema:"ISO 3166-1 alpha-2 region code, such as US or BR"`
}

type updateProfileOut struct {
	Language string `json:"language"`
	Region   string `json:"region"`
}

func updateProfile(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "update_profile",
		Description: "Proposes changing the user's language or region, which set the language of the app and of these answers " +
			"and the format of numbers and dates. " +
			"Use it when the user asks to switch language or region. " +
			"Do not use it for the base currency, which is fixed after the first transaction. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, userID int64, in updateProfileIn) (tool.Preview, error) {
		if in.Language == "" && in.Region == "" {
			return tool.Preview{}, tool.InvalidArgument("language", "or region is required")
		}
		before, after, err := svc.ProfileChange(ctx, userID, in.Language, in.Region)
		if err != nil {
			return tool.Preview{}, err
		}
		return tool.Preview{Action: "update_profile", Changes: []tool.Change{
			{Field: "language", Before: tool.TextValue(before.Language), After: tool.TextValue(after.Language)},
			{Field: "region", Before: tool.TextValue(before.Region), After: tool.TextValue(after.Region)},
		}}, nil
	}, func(ctx context.Context, userID int64, in updateProfileIn) (updateProfileOut, error) {
		if in.Language == "" && in.Region == "" {
			return updateProfileOut{}, tool.InvalidArgument("language", "or region is required")
		}
		before, _, err := svc.ProfileChange(ctx, userID, in.Language, in.Region)
		if err != nil {
			return updateProfileOut{}, err
		}
		u, err := svc.UpdateProfile(ctx, domain.User{ID: userID, Language: before.Language, Region: before.Region}, in.Language, in.Region)
		if err != nil {
			return updateProfileOut{}, err
		}
		return updateProfileOut{Language: u.Language, Region: u.Region}, nil
	})
}
