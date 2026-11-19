package app

import (
	"fmt"
	"slices"
	"strings"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
	pview "github.com/andrelopes-code/equori/internal/platform/view"
)

// Limits of the reads and views of one turn (answer views design, V1 and V5).
const (
	maxReads     = 24
	maxReadBytes = 256 << 10
	maxViews     = 3
)

// The view types live in platform/view, so each module builds the views of its reads.
type (
	ViewKey     = pview.Key
	ViewSelect  = pview.Select
	ViewBuilder = pview.Builder
	ViewPayload = pview.Payload
)

// UseViews sets the registry of view builders.
func (s *Service) UseViews(builders map[ViewKey]ViewBuilder) { s.views = builders }

// FormsOf returns the forms the registry draws for the output of tool, sorted.
func (s *Service) FormsOf(tool string) []string {
	var forms []string
	for k := range s.views {
		if k.Tool == tool {
			forms = append(forms, k.Form)
		}
	}

	slices.Sort(forms)

	return forms
}

func (t *turnState) addRead(tool string, out []byte) (string, bool) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if len(t.reads) >= maxReads || len(out) > maxReadBytes {
		return "", false
	}

	t.reads = append(t.reads, turnRead{tool: tool, out: out})

	return fmt.Sprintf("r%d", len(t.reads)), true
}

func (t *turnState) read(handle string) (string, []byte, bool) {
	t.mu.Lock()
	defer t.mu.Unlock()

	var n int
	if _, err := fmt.Sscanf(handle, "r%d", &n); err != nil || n < 1 || n > len(t.reads) ||
		handle != fmt.Sprintf("r%d", n) {
		return "", nil, false
	}

	r := t.reads[n-1]

	return r.tool, r.out, true
}

func (t *turnState) addView(v domain.View) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if len(t.views) >= maxViews {
		return domain.ErrTooManyViews
	}

	v.Seq = len(t.views)
	t.views = append(t.views, v)

	return nil
}

func (t *turnState) takeViews() []domain.View {
	t.mu.Lock()
	defer t.mu.Unlock()

	views := t.views
	t.views = nil

	return views
}

func (t *turnState) handles() string {
	t.mu.Lock()
	defer t.mu.Unlock()

	if len(t.reads) == 0 {
		return "none"
	}

	hs := make([]string, len(t.reads))
	for i, r := range t.reads {
		hs[i] = fmt.Sprintf("r%d (%s)", i+1, r.tool)
	}

	return strings.Join(hs, ", ")
}

type turnRead struct {
	tool string
	out  []byte
}
