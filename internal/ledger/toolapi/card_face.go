package toolapi

import (
	"context"

	"github.com/andrelopes-code/equori/internal/ledger/app"
	"github.com/andrelopes-code/equori/internal/ledger/domain"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

type cardFaceChip string

func (cardFaceChip) Values() []string { return []string{"gold", "silver"} }

type cardFaceOrientation string

func (cardFaceOrientation) Values() []string { return []string{"horizontal", "vertical"} }

type cardFaceBrand string

func (cardFaceBrand) Values() []string { return []string{"auto", "plate", "name", "none"} }

type setCardFaceIn struct {
	AccountID   string              `json:"account_id"           jsonschema:"credit card account, from list_accounts"`
	Color       string              `json:"color,omitzero"       jsonschema:"colour of the card as lower case #rrggbb, such as #820ad1"`
	Art         string              `json:"art,omitzero"         jsonschema:"pattern drawn on the card: plain, aurora, waves, orbits, band, contour, dots, carbon, brushed or holo"`
	Chip        cardFaceChip        `json:"chip,omitzero"        jsonschema:"colour of the chip"`
	Orientation cardFaceOrientation `json:"orientation,omitzero" jsonschema:"how the card is drawn"`
	Brand       cardFaceBrand       `json:"brand,omitzero"       jsonschema:"how the institution appears: auto picks, plate draws its mark, name writes its name, none hides it"`
}

type setCardFaceOut struct {
	AccountID string `json:"account_id"`
}

func setCardFace(svc *app.Service) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "set_card_face",
		Description: "Proposes how a credit card is drawn in the app: its colour, pattern, chip, orientation and the mark of the institution. " +
			"It replaces the whole face: a value left out returns to the default, and a call with only account_id clears the face. " +
			"Use it when the user asks to change the look of a card. " +
			"Do not use it for the limit, the cycle or the plastic cards: manage_card does. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(ctx context.Context, booksID int64, in setCardFaceIn) (tool.Preview, error) {
		id, err := optionalID(in.AccountID, "account_id")
		if err != nil {
			return tool.Preview{}, err
		}

		account, err := svc.Account(ctx, booksID, id)
		if err != nil {
			return tool.Preview{}, err
		}

		pv := tool.Preview{Action: "set_card_face", Target: account.Name}
		for _, v := range []string{
			in.Color, in.Art, string(in.Chip), string(in.Orientation), string(in.Brand),
		} {
			if v != "" {
				pv.Changes = append(
					pv.Changes,
					tool.Change{Field: "card", After: tool.TextValue(v)},
				)
			}
		}

		return pv, nil
	}, func(ctx context.Context, booksID int64, in setCardFaceIn) (setCardFaceOut, error) {
		id, err := optionalID(in.AccountID, "account_id")
		if err != nil {
			return setCardFaceOut{}, err
		}

		_, err = svc.SetCardFace(ctx, booksID, id, domain.CardFace{
			Color:       in.Color,
			Art:         in.Art,
			Chip:        string(in.Chip),
			Orientation: string(in.Orientation),
			Brand:       string(in.Brand),
		})

		return setCardFaceOut{AccountID: in.AccountID}, err
	})
}
