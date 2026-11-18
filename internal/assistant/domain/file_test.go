package domain_test

import (
	"bytes"
	"testing"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
)

// Assistant parity design F3: the kind of a conversation file comes from its content, never from
// its name or its declared type.
func TestFileKind(t *testing.T) {
	t.Parallel()

	png := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")
	jpeg := []byte("\xff\xd8\xff\xe0\x00\x10JFIF\x00")
	webp := []byte("RIFF\x24\x00\x00\x00WEBPVP8 ")

	for _, tc := range []struct {
		name      string
		content   []byte
		kind      domain.FileKind
		mediaType string
	}{
		{"ofx with header", []byte("OFXHEADER:100\nDATA:OFXSGML\n\n<OFX><BANKMSGSRSV1>"), domain.FileOFX, "application/x-ofx"},
		{"ofx as xml", []byte("<?xml version=\"1.0\"?>\n<?OFX OFXHEADER=\"200\"?>\n<OFX>"), domain.FileOFX, "application/x-ofx"},
		{"csv with commas", []byte("date,amount,description\n2026-11-01,-10.00,Coffee\n"), domain.FileCSV, "text/csv"},
		{"csv with semicolons", []byte("Data;Valor;Histórico\n01/11/2026;-10,00;Café\n"), domain.FileCSV, "text/csv"},
		{"text", []byte("Receipt of the market\nTotal 10.00\n"), domain.FileText, "text/plain"},
		{"pdf", []byte("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj"), domain.FilePDF, "application/pdf"},
		{"png", png, domain.FileImage, "image/png"},
		{"jpeg", jpeg, domain.FileImage, "image/jpeg"},
		{"webp", webp, domain.FileImage, "image/webp"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			kind, mediaType, err := domain.DetectFileKind(tc.content)
			if err != nil {
				t.Fatalf("DetectFileKind = %v", err)
			}

			if kind != tc.kind || mediaType != tc.mediaType {
				t.Errorf("kind = %s %s, want %s %s", kind, mediaType, tc.kind, tc.mediaType)
			}
		})
	}
}

func TestFileKindRefusesOtherContent(t *testing.T) {
	t.Parallel()

	for name, content := range map[string][]byte{
		"zip":    []byte("PK\x03\x04\x14\x00\x00\x00"),
		"gif":    []byte("GIF89a\x01\x00\x01\x00"),
		"binary": bytes.Repeat([]byte{0x00, 0x01, 0xfe}, 20),
		"empty":  {},
	} {
		if _, _, err := domain.DetectFileKind(content); err != domain.ErrFileKindUnsupported {
			t.Errorf("%s: err = %v, want ErrFileKindUnsupported", name, err)
		}
	}
}
