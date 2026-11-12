package main

import (
	"fmt"
	"strings"
)

// attach stores a PDF of the document under the transaction, the way an owner keeps the invoice of a purchase.
func (s *seeder) attach(txID, name string, lines ...string) {
	s.upload("/transactions/"+txID+"/attachments", nil, name, miniPDF(lines))
}

// miniPDF writes a one-page PDF that prints the lines.
func miniPDF(lines []string) []byte {
	var text strings.Builder

	text.WriteString("BT /F1 12 Tf 56 780 Td 16 TL\n")

	for _, l := range lines {
		fmt.Fprintf(
			&text,
			"(%s) Tj T*\n",
			strings.NewReplacer(`\`, `\\`, "(", `\(`, ")", `\)`).Replace(l),
		)
	}

	text.WriteString("ET")

	return fmt.Appendf(nil, "%%PDF-1.4\n"+
		"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"+
		"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"+
		"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"+
		"4 0 obj<</Length %d>>stream\n%s\nendstream endobj\n"+
		"5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"+
		"trailer<</Root 1 0 R/Size 6>>\n%%%%EOF\n", text.Len(), text.String())
}
