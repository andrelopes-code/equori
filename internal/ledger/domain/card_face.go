package domain

import "regexp"

// CardFace is the appearance of a credit card account (card faces spec 4.9); "" is unset and the
// face applies its default.
type CardFace struct {
	Color, Art, Chip, Orientation, Brand string
}

var (
	faceColorPattern = regexp.MustCompile(`^#[0-9a-f]{6}$`)
	faceArtPattern   = regexp.MustCompile(`^[a-z0-9_]{2,40}$`)
)

// NewCardFace validates every value that is set.
func NewCardFace(f CardFace) (CardFace, error) {
	switch {
	case f.Color != "" && !faceColorPattern.MatchString(f.Color):
		return CardFace{}, invalid("face.color", "must be a lower case colour #rrggbb")
	case f.Art != "" && !faceArtPattern.MatchString(f.Art):
		return CardFace{}, invalid("face.art", "must be 2 to 40 characters of a-z, 0-9 and _")
	case f.Chip != "" && f.Chip != "gold" && f.Chip != "silver":
		return CardFace{}, invalid("face.chip", "must be gold or silver")
	case f.Orientation != "" && f.Orientation != "horizontal" && f.Orientation != "vertical":
		return CardFace{}, invalid("face.orientation", "must be horizontal or vertical")
	case f.Brand != "" && !isFaceBrand(f.Brand):
		return CardFace{}, invalid("face.brand", "must be auto, plate, name or none")
	}

	return f, nil
}

func isFaceBrand(b string) bool {
	return b == "auto" || b == "plate" || b == "name" || b == "none"
}
