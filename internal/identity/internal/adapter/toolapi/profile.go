package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/identity/internal/app"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type updateProfileIn struct {
	Language string `json:"language,omitzero" jsonschema:"ISO 639 language code, such as en or pt"`
}

type updateProfileOut struct {
	Language string `json:"language"`
	Region   string `json:"region"`
}

func updateProfile(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "update_profile",
		Description: "Proposes changing the member's language, which sets the language of the app and of these answers. " +
			"Use it when the user asks to switch language. " +
			"Do not use it for the region or the base currency of the book, which a book owner changes in settings. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in updateProfileIn) (tool.Preview, error) {
		if in.Language == "" {
			return tool.Preview{}, tool.InvalidArgument("language", "is required")
		}

		before, after, err := svc.ProfileChange(ctx, booksID, auth.MustMemberID(ctx), in.Language, "")
		if err != nil {
			return tool.Preview{}, err
		}

		return tool.Preview{Action: "update_profile", Changes: []tool.Change{
			{Field: "language", Before: tool.TextValue(before.Language), After: tool.TextValue(after.Language)},
		}}, nil
	}, func(ctx context.Context, booksID int64, in updateProfileIn) (updateProfileOut, error) {
		if in.Language == "" {
			return updateProfileOut{}, tool.InvalidArgument("language", "is required")
		}

		l, err := svc.UpdateProfile(ctx, booksID, auth.MustMemberID(ctx), in.Language, "")
		if err != nil {
			return updateProfileOut{}, err
		}

		return updateProfileOut{Language: l.Language, Region: l.Region}, nil
	})
}
