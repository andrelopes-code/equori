package toolapi

import (
	"context"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/reporting/app"
)

// exportContentPath is the operation getExportContent, which answers the archive itself.
const exportContentPath = "/api/v1/exports/current/content"

type exportIn struct{}

type exportOut struct {
	Status       string `json:"status"                 jsonschema:"pending while the archive is built, ready, or failed"`
	RequestedAt  string `json:"requested_at"           jsonschema:"UTC time of the request"`
	Size         int64  `json:"size,omitzero"          jsonschema:"bytes of the archive, when ready"`
	Problem      string `json:"problem,omitzero"       jsonschema:"code of the failure, such as export_too_large"`
	DownloadPath string `json:"download_path,omitzero" jsonschema:"when ready: path the user opens in the app to download the archive"`
}

func requestExport(exports *app.Exports) tool.Tool {
	return tool.NewWrite(tool.Spec{
		Name: "request_export",
		Description: "Proposes an export of the book: one archive with every fact, to keep as a copy or to restore into another book. " +
			"It is refused while another export is pending (export_pending); get_export reads its state and, when ready, the path that downloads it. " +
			"Use it when the user asks for a backup or a copy of the data. " +
			"The archive carries no credential of a bank integration: the owner adds them with a passphrase in Settings, Data. " +
			"Do not use it to restore an archive: the owner does that in Settings, Data. " +
			"The user confirms first.",
		Effect: tool.Write,
	}, func(context.Context, int64, exportIn) (tool.Preview, error) {
		return tool.Preview{Action: "request_export"}, nil
	}, func(ctx context.Context, booksID int64, _ exportIn) (exportOut, error) {
		e, err := exports.Request(ctx, booksID, "")

		return toExportOut(e), err
	})
}

func getExport(exports *app.Exports) tool.Tool {
	return tool.New(tool.Spec{
		Name: "get_export",
		Description: "Returns the latest export of the book: whether the archive is pending, ready or failed, its size and, when ready, the path that downloads it. " +
			"Use it after request_export or when the user asks where the backup is. " +
			"Without an export it answers not_found. " +
			"Do not use it to start an export: request_export does.",
		Effect: tool.ReadOnly,
	}, func(ctx context.Context, booksID int64, _ exportIn) (exportOut, error) {
		e, err := exports.Get(ctx, booksID)

		return toExportOut(e), err
	})
}

func toExportOut(e app.Export) exportOut {
	out := exportOut{
		Status:      string(e.Status),
		RequestedAt: e.RequestedAt.UTC().Format(time.RFC3339),
		Size:        e.Size,
		Problem:     e.Problem,
	}
	if e.Status == app.ExportReady {
		out.DownloadPath = exportContentPath
	}

	return out
}
