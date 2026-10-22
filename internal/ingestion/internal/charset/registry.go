package charset

import (
	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/encoding/korean"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"
)

// Decoder returns the encoding named by a CSV profile; utf-8 is the identity encoding.
func Decoder(name string) (encoding.Encoding, bool) {
	switch name {
	case "utf-8":
		return encoding.Nop, true
	case "windows-1252":
		return charmap.Windows1252, true
	case "iso-8859-1":
		return charmap.ISO8859_1, true
	case "iso-8859-15":
		return charmap.ISO8859_15, true
	case "windows-1250":
		return charmap.Windows1250, true
	case "windows-1251":
		return charmap.Windows1251, true
	case "shift_jis":
		return japanese.ShiftJIS, true
	case "gb18030":
		return simplifiedchinese.GB18030, true
	case "euc-kr":
		return korean.EUCKR, true
	case "big5":
		return traditionalchinese.Big5, true
	}
	return nil, false
}

// Names lists the accepted encoding names, auto first.
func Names() []string {
	return []string{"auto", "utf-8", "windows-1252", "iso-8859-1", "iso-8859-15", "windows-1250", "windows-1251", "shift_jis", "gb18030", "euc-kr", "big5"}
}
