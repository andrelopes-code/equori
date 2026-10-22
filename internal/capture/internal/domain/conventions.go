package domain

// DateOrder is the order of the parts of a numeric date.
type DateOrder string

const (
	DMY DateOrder = "dmy"
	MDY DateOrder = "mdy"
	YMD DateOrder = "ymd"
)

// Conventions are the separators and the date order a line is read with.
type Conventions struct {
	Decimal, Group rune
	Order          DateOrder
}
