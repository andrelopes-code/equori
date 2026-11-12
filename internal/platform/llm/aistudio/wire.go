package aistudio

import (
	"bytes"
	"encoding/json"

	"github.com/andrelopes-code/equori/internal/platform/llm"
)

// Request and response bodies of models.generateContent (ai.google.dev/api/generate-content).

type generateRequest struct {
	SystemInstruction *content          `json:"systemInstruction,omitempty"`
	Contents          []content         `json:"contents"`
	Tools             []tool            `json:"tools,omitempty"`
	ToolConfig        *toolConfig       `json:"toolConfig,omitempty"`
	GenerationConfig  *generationConfig `json:"generationConfig,omitempty"`
}

type content struct {
	Role  string `json:"role,omitempty"`
	Parts []part `json:"parts"`
}

// part keeps Text as a pointer so a text part carrying only a signature still sends "text".
type part struct {
	Text             *string           `json:"text,omitempty"`
	Thought          bool              `json:"thought,omitempty"`
	FunctionCall     *functionCall     `json:"functionCall,omitempty"`
	FunctionResponse *functionResponse `json:"functionResponse,omitempty"`
	ThoughtSignature []byte            `json:"thoughtSignature,omitempty"`
}

type functionCall struct {
	ID   string          `json:"id,omitempty"`
	Name string          `json:"name"`
	Args json.RawMessage `json:"args,omitempty"`
}

type functionResponse struct {
	ID       string          `json:"id,omitempty"`
	Name     string          `json:"name"`
	Response json.RawMessage `json:"response"`
}

type tool struct {
	FunctionDeclarations []functionDeclaration `json:"functionDeclarations"`
}

type toolConfig struct {
	FunctionCallingConfig struct {
		Mode string `json:"mode"`
	} `json:"functionCallingConfig"`
}

type functionDeclaration struct {
	Name                 string          `json:"name"`
	Description          string          `json:"description,omitempty"`
	ParametersJSONSchema json.RawMessage `json:"parametersJsonSchema,omitempty"`
}

type generationConfig struct {
	ResponseMimeType   string          `json:"responseMimeType,omitempty"`
	ResponseJSONSchema json.RawMessage `json:"responseJsonSchema,omitempty"`
	MaxOutputTokens    int             `json:"maxOutputTokens,omitempty"`
	Temperature        *float64        `json:"temperature,omitempty"`
	ThinkingConfig     *thinkingConfig `json:"thinkingConfig,omitempty"`
}

type thinkingConfig struct {
	ThinkingLevel string `json:"thinkingLevel"`
}

type generateResponse struct {
	Candidates     []candidate `json:"candidates"`
	PromptFeedback *struct {
		BlockReason string `json:"blockReason"`
	} `json:"promptFeedback"`
	UsageMetadata struct {
		PromptTokenCount     int `json:"promptTokenCount"`
		CandidatesTokenCount int `json:"candidatesTokenCount"`
		ThoughtsTokenCount   int `json:"thoughtsTokenCount"`
	} `json:"usageMetadata"`
}

type candidate struct {
	Content      *content `json:"content"`
	FinishReason string   `json:"finishReason"`
}

func toWire(req llm.Request) generateRequest {
	w := generateRequest{Contents: []content{}}
	if req.System != "" {
		s := req.System
		w.SystemInstruction = &content{Parts: []part{{Text: &s}}}
	}

	for _, m := range req.Messages {
		role := "user"
		if m.Role == llm.RoleModel {
			role = "model"
		}

		c := content{Role: role, Parts: []part{}}
		for _, p := range m.Parts {
			c.Parts = append(c.Parts, partToWire(p))
		}

		w.Contents = append(w.Contents, c)
	}

	if len(req.Tools) > 0 {
		w.addTools(req)
	}

	if req.Schema != nil || req.MaxOutputTokens > 0 || req.Temperature != nil ||
		req.Thinking != "" {
		w.addGenerationConfig(req)
	}

	return w
}

// addTools sets the function declarations and the tool choice of req.
func (w *generateRequest) addTools(req llm.Request) {
	var decls []functionDeclaration
	for _, t := range req.Tools {
		decls = append(
			decls,
			functionDeclaration{
				Name:                 t.Name,
				Description:          t.Description,
				ParametersJSONSchema: t.Parameters,
			},
		)
	}

	w.Tools = []tool{{FunctionDeclarations: decls}}
	if req.ToolChoice == llm.ToolChoiceNone {
		w.ToolConfig = &toolConfig{}
		w.ToolConfig.FunctionCallingConfig.Mode = "NONE"
	}
}

// addGenerationConfig sets the generation configuration of req.
func (w *generateRequest) addGenerationConfig(req llm.Request) {
	cfg := &generationConfig{MaxOutputTokens: req.MaxOutputTokens, Temperature: req.Temperature}
	if req.Schema != nil {
		cfg.ResponseMimeType, cfg.ResponseJSONSchema = "application/json", req.Schema
	}

	if req.Thinking == "low" {
		cfg.ThinkingConfig = &thinkingConfig{ThinkingLevel: "LOW"}
	}

	w.GenerationConfig = cfg
}

func partToWire(p llm.Part) part {
	var w part
	switch {
	case p.ToolCall != nil:
		w.FunctionCall = &functionCall{
			ID:   p.ToolCall.ID,
			Name: p.ToolCall.Name,
			Args: p.ToolCall.Args,
		}
	case p.ToolResult != nil:
		w.FunctionResponse = &functionResponse{
			ID:       p.ToolResult.CallID,
			Name:     p.ToolResult.Name,
			Response: asObject(p.ToolResult.Content),
		}
	default:
		t := p.Text
		w.Text = &t
	}

	if p.Signature != nil && p.Signature.Provider == name {
		w.ThoughtSignature = p.Signature.Data
	}

	return w
}

// asObject wraps content that is not a JSON object, because functionResponse.response must
// be one.
func asObject(content json.RawMessage) json.RawMessage {
	trimmed := bytes.TrimSpace(content)
	if len(trimmed) > 0 && trimmed[0] == '{' {
		return content
	}

	if len(trimmed) == 0 {
		trimmed = []byte("null")
	}

	b, _ := json.Marshal(map[string]json.RawMessage{"result": trimmed})

	return b
}

func fromWire(w generateResponse) llm.Response {
	resp := llm.Response{
		Message: llm.Message{Role: llm.RoleModel},
		Usage: llm.Usage{
			InputTokens:  w.UsageMetadata.PromptTokenCount,
			OutputTokens: w.UsageMetadata.CandidatesTokenCount + w.UsageMetadata.ThoughtsTokenCount,
		},
	}
	if len(w.Candidates) == 0 {
		resp.FinishReason = llm.FinishOther
		if w.PromptFeedback != nil && w.PromptFeedback.BlockReason != "" {
			resp.FinishReason = llm.FinishBlocked
		}

		return resp
	}

	c := w.Candidates[0]

	hasCall := false
	if c.Content != nil {
		for _, p := range c.Content.Parts {
			if p.Thought {
				continue
			}

			var np llm.Part
			switch {
			case p.FunctionCall != nil:
				np.ToolCall = &llm.ToolCall{
					ID:   p.FunctionCall.ID,
					Name: p.FunctionCall.Name,
					Args: p.FunctionCall.Args,
				}
				hasCall = true
			case p.Text != nil:
				np.Text = *p.Text
			}

			if len(p.ThoughtSignature) > 0 {
				np.Signature = &llm.Signature{Provider: name, Data: p.ThoughtSignature}
			}

			resp.Message.Parts = append(resp.Message.Parts, np)
		}
	}

	resp.FinishReason = finishReason(c.FinishReason, hasCall)

	return resp
}

func finishReason(reason string, hasCall bool) llm.FinishReason {
	switch reason {
	case "STOP", "":
		if hasCall {
			return llm.FinishToolCalls
		}

		if reason == "" {
			return llm.FinishOther
		}

		return llm.FinishStop
	case "MAX_TOKENS":
		return llm.FinishLength
	case "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII":
		return llm.FinishBlocked
	default:
		return llm.FinishOther
	}
}
