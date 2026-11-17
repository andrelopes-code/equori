package ledger

import "testing"

// Card faces spec 4.9: each CHECK of the five face columns of ledger_account refuses a value
// outside its set.
func TestAccountCardFaceSchema(t *testing.T) {
	t.Parallel()
	f := newCardFixture(t)

	for _, c := range []struct {
		column, value, constraint string
	}{
		{"face_color", "#820AD1", "ledger_account_face_color_check"},
		{"face_color", "820ad1", "ledger_account_face_color_check"},
		{"face_art", "A B", "ledger_account_face_art_check"},
		{"face_art", "a", "ledger_account_face_art_check"},
		{"face_chip", "bronze", "ledger_account_face_chip_check"},
		{"face_orientation", "diagonal", "ledger_account_face_orientation_check"},
		{"face_brand", "logo", "ledger_account_face_brand_check"},
	} {
		_, err := f.pool.Exec(
			t.Context(),
			"UPDATE ledger_account SET "+c.column+" = $1 WHERE id = $2",
			c.value, f.card,
		)
		requireViolation(t, err, checkViolation, c.constraint)
	}
}
