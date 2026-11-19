package app

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/andrelopes-code/equori/internal/assistant/domain"
)

// Limits of the reads and views of one turn (answer views design, V1 and V5).
const (
	maxReads     = 24
	maxReadBytes = 256 << 10
	maxViews     = 3
)

// ViewKey names a builder: the read tool whose output it presents and the form it draws.
type ViewKey struct {
	Tool, Form string
}

// ViewSelect is what the model narrows in a view: the rows kept and the one highlighted.
type ViewSelect struct {
	Limit     int    `json:"limit,omitzero"`
	Highlight string `json:"highlight,omitzero"`
}

// ViewBuilder turns the outputs of one or two reads into the payload of a view (V4).
type ViewBuilder func(outputs []json.RawMessage, sel ViewSelect, today time.Time) (ViewPayload, error)

// ViewPayload is a view as the client draws it (V6). Figures are typed values, never formatted text (V7).
type ViewPayload struct {
	Title   ViewText   `json:"title"`
	Window  ViewWindow `json:"window"`
	Verdict ViewText   `json:"verdict"`
	Prov    *ViewText  `json:"prov,omitempty"`
	Open    *ViewLink  `json:"open,omitempty"`
	Next    []string   `json:"next"`
	Rows    ViewTable  `json:"rows"`
	Data    any        `json:"data"`
}

// ViewText is a catalog key and its typed params.
type ViewText struct {
	Key    string               `json:"key"`
	Params map[string]ViewValue `json:"params,omitempty"`
}

// ViewValue is one typed figure: text, an amount, a share in basis points, a count or a date.
type ViewValue struct {
	Text  string     `json:"text,omitempty"`
	Money *ViewMoney `json:"money,omitempty"`
	BP    *int64     `json:"bp,omitempty"`
	Count *int64     `json:"count,omitempty"`
	Date  string     `json:"date,omitempty"`
}

// ViewMoney is an amount in minor units of its currency.
type ViewMoney struct {
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
}

// ViewWindow is the period or instant a view covers, as calendar dates.
type ViewWindow struct {
	From     string `json:"from,omitempty"`
	To       string `json:"to,omitempty"`
	At       string `json:"at,omitempty"`
	LabelKey string `json:"label_key,omitempty"`
}

// ViewLink names the screen that holds the records of a view.
type ViewLink struct {
	Screen string            `json:"screen"`
	Params map[string]string `json:"params,omitempty"`
}

// ViewTable is the view as rows: the table the client shows in place of the chart and copies.
type ViewTable struct {
	Head []string      `json:"head"`
	Rows [][]ViewValue `json:"rows"`
}

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
