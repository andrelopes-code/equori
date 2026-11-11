package ingestion

import (
	"github.com/andrelopes-code/equori/internal/ingestion/app"
	"github.com/andrelopes-code/equori/internal/ingestion/llmapi"
)

// SuggestColumnsUse is the language model use that identifies the columns of a CSV file (A206).
var SuggestColumnsUse = llmapi.Use

// ErrIntegrationUnavailable: the instance has no EQUORI_SECRET_KEY (ADR 008, K2).
var ErrIntegrationUnavailable = app.ErrIntegrationUnavailable

// FeedState is the feed of a ledger account (P12 A152).
type FeedState = app.FeedState

// ConnectionDiagnostic is one connection as the diagnostic file reports it (P13 A158).
type ConnectionDiagnostic = app.ConnectionDiagnostic
