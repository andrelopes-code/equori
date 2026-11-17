package anthropic

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/andrelopes-code/equori/internal/platform/llm"
)

// maxBlocks bounds the content block index a streamed response may name.
const maxBlocks = 256

type streamEvent struct {
	Type    string `json:"type"`
	Index   int    `json:"index"`
	Message struct {
		Usage usage `json:"usage"`
	} `json:"message"`
	ContentBlock map[string]json.RawMessage `json:"content_block"`
	Delta        struct {
		Type        string `json:"type"`
		Text        string `json:"text"`
		PartialJSON string `json:"partial_json"`
		Thinking    string `json:"thinking"`
		Signature   string `json:"signature"`
		StopReason  string `json:"stop_reason"`
	} `json:"delta"`
	Usage usage `json:"usage"`
	Error struct {
		Type string `json:"type"`
	} `json:"error"`
}

// streamState accumulates the events of one stream.
type streamState struct {
	blocks []*streamBlock
	usage  usage
	stop   string
}

// streamBlock is one content block: the fields of its start event, and the deltas each field
// received after it.
type streamBlock struct {
	start     map[string]json.RawMessage
	text      strings.Builder
	input     strings.Builder
	thinking  strings.Builder
	signature string
}

func (st *streamState) read(r io.Reader, model string, onText func(string)) error {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64<<10), 1<<20)

	for scanner.Scan() {
		data, ok := strings.CutPrefix(strings.TrimSpace(scanner.Text()), "data:")
		if !ok {
			continue
		}

		var ev streamEvent
		if err := json.Unmarshal([]byte(strings.TrimSpace(data)), &ev); err != nil {
			return fmt.Errorf("anthropic %s: decode event: %w", model, err)
		}

		if err := st.apply(ev, onText); err != nil {
			return fmt.Errorf("anthropic %s: %w", model, err)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("anthropic %s: read stream: %w: %w", model, llm.ErrTransient, err)
	}

	return nil
}

// apply folds one event into the state. The error event's message is left out: it may echo
// the request.
func (st *streamState) apply(ev streamEvent, onText func(string)) error {
	switch ev.Type {
	case "message_start":
		st.usage = ev.Message.Usage
	case "content_block_start":
		// The index comes from the server; a response never holds this many blocks.
		if ev.Index < 0 || ev.Index >= maxBlocks {
			return fmt.Errorf("content block index %d: %w", ev.Index, llm.ErrTransient)
		}

		for len(st.blocks) <= ev.Index {
			st.blocks = append(st.blocks, nil)
		}

		st.blocks[ev.Index] = &streamBlock{start: ev.ContentBlock}
	case "content_block_delta":
		if ev.Index < 0 || ev.Index >= len(st.blocks) || st.blocks[ev.Index] == nil {
			return fmt.Errorf("delta of unknown block %d: %w", ev.Index, llm.ErrTransient)
		}

		st.blocks[ev.Index].applyDelta(ev, onText)
	case "message_delta":
		st.usage.OutputTokens = ev.Usage.OutputTokens
		st.stop = ev.Delta.StopReason
	case "error":
		return fmt.Errorf("stream error %s: %w", ev.Error.Type, llm.ErrTransient)
	}

	return nil
}

func (b *streamBlock) applyDelta(ev streamEvent, onText func(string)) {
	switch ev.Delta.Type {
	case "text_delta":
		onText(ev.Delta.Text)
		b.text.WriteString(ev.Delta.Text)
	case "input_json_delta":
		b.input.WriteString(ev.Delta.PartialJSON)
	case "thinking_delta":
		b.thinking.WriteString(ev.Delta.Thinking)
	case "signature_delta":
		b.signature = ev.Delta.Signature
	}
}

// response builds the message a non-streamed request would have returned.
func (st *streamState) response() (messagesResponse, error) {
	wire := messagesResponse{StopReason: st.stop, Usage: st.usage}

	for _, b := range st.blocks {
		if b == nil {
			continue
		}

		raw, err := b.content()
		if err != nil {
			return messagesResponse{}, err
		}

		wire.Content = append(wire.Content, raw)
	}

	return wire, nil
}

// content returns the block with its deltas written over the fields of its start event.
func (b *streamBlock) content() (json.RawMessage, error) {
	fields := map[string]any{}
	for key, value := range b.start {
		fields[key] = value
	}

	if b.text.Len() > 0 {
		fields["text"] = b.text.String()
	}

	if b.thinking.Len() > 0 {
		fields["thinking"] = b.thinking.String()
	}

	if b.signature != "" {
		fields["signature"] = b.signature
	}

	if b.input.Len() > 0 {
		input := json.RawMessage(b.input.String())
		if !json.Valid(input) {
			return nil, fmt.Errorf("tool input is not valid JSON: %w", llm.ErrTransient)
		}

		fields["input"] = input
	}

	raw, err := json.Marshal(fields)
	if err != nil {
		return nil, fmt.Errorf("encode content block: %w", err)
	}

	return raw, nil
}
