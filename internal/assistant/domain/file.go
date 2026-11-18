package domain

import (
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

// FileKind is the kind of a conversation file, a file a member attaches to a message (assistant
// parity design, F3).
type FileKind string

const (
	FileOFX   FileKind = "ofx"
	FileCSV   FileKind = "csv"
	FilePDF   FileKind = "pdf"
	FileImage FileKind = "image"
	FileText  FileKind = "text"
)

// File is a stored conversation file without its content. ConversationID is uuid.Nil while the
// file is not yet sent (Q6).
type File struct {
	ID             uuid.UUID
	ConversationID uuid.UUID
	MessageID      uuid.UUID
	Name           string
	MediaType      string
	Kind           FileKind
	Size           int
	CreatedAt      time.Time
	// Summary is what the model reads of the content, besides the descriptor line (F4).
	Summary string
	// Unread marks a pdf, image or text file the model of the turn does not read (F5).
	Unread bool
}

// Readable reports whether the model reads the content of a file of this kind as a file part.
func (k FileKind) Readable() bool { return k == FilePDF || k == FileImage || k == FileText }

// Descriptor is what the model receives about a file: its id, name, kind and size, then its
// summary (F4).
func (f File) Descriptor() string {
	line := fmt.Sprintf("[file %s: %s, %s, %d bytes]", f.ID, f.Name, f.Kind, f.Size)
	if f.Unread {
		line += "\nThe content of this file was not read: the model of the chat does not read files."
	}

	if f.Summary == "" {
		return line
	}

	return line + "\n" + f.Summary
}

// Limits of F2 and F3.
const (
	MaxFileBytes             = 10 << 20
	MaxConversationFileBytes = 50 << 20
	MaxTurnFiles             = 5
)

var (
	ErrFileKindUnsupported   = errors.New("file kind unsupported")
	ErrFileTooLarge          = errors.New("file too large")
	ErrConversationFilesFull = errors.New("conversation files full")
	ErrFileNotFound          = errors.New("file not found")
)

// sniffBytes is how much of the start of a file the detection reads.
const sniffBytes = 4096

// DetectFileKind returns the kind and the media type of a file from its content;
// ErrFileKindUnsupported for any other content.
func DetectFileKind(content []byte) (FileKind, string, error) {
	switch sniffed := http.DetectContentType(content); {
	case sniffed == "application/pdf":
		return FilePDF, sniffed, nil
	case sniffed == "image/jpeg", sniffed == "image/png", sniffed == "image/webp":
		return FileImage, sniffed, nil
	case len(content) == 0 || !strings.HasPrefix(sniffed, "text/"):
		return "", "", ErrFileKindUnsupported
	}

	head := content[:min(len(content), sniffBytes)]

	switch {
	case isOFX(head):
		return FileOFX, "application/x-ofx", nil
	case isCSV(head):
		return FileCSV, "text/csv", nil
	}

	return FileText, "text/plain", nil
}

// isOFX recognizes the SGML header of OFX 1 and the processing instruction of OFX 2.
func isOFX(head []byte) bool {
	text := strings.ToUpper(string(bytes.TrimLeft(head, "\ufeff \t\r\n")))

	return strings.HasPrefix(text, "OFXHEADER:") || strings.Contains(text, "<?OFX") ||
		strings.Contains(text, "<OFX>")
}

// isCSV reads the first two lines as a header and a record: both hold the same count, above
// zero, of one delimiter.
func isCSV(head []byte) bool {
	var lines []string
	for line := range strings.Lines(string(head)) {
		if line = strings.TrimSpace(line); line != "" {
			lines = append(lines, line)
		}

		if len(lines) == 2 {
			break
		}
	}

	if len(lines) < 2 {
		return false
	}

	for _, delimiter := range []string{";", "\t", ","} {
		n := strings.Count(lines[0], delimiter)
		if n > 0 && n == strings.Count(lines[1], delimiter) {
			return true
		}
	}

	return false
}
