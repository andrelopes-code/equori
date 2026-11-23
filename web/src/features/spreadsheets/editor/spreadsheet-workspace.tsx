import { Page, PageBody } from "@slotted/react/page";
import { toast } from "@slotted/react/toast";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { errorText } from "@/api/problem";
import { useCreateSpreadsheet } from "@/features/spreadsheets/api";
import type {
  SpreadsheetDocument,
  SpreadsheetSummary,
} from "@/features/spreadsheets/api";
import type { DocumentCommand } from "@/features/spreadsheets/document-list/document-command";
import { DocumentDialogs } from "@/features/spreadsheets/document-list/document-dialogs";
import { SaveNotice } from "@/features/spreadsheets/editor/save-notice";
import { SpreadsheetEditor } from "@/features/spreadsheets/editor/spreadsheet-editor";
import styles from "@/features/spreadsheets/editor/spreadsheet-workspace.module.css";
import { downloadDocument } from "@/features/spreadsheets/files/download-document";
import { useDocumentSave } from "@/features/spreadsheets/editor/use-document-save";
import { WorkspaceHeader } from "@/features/spreadsheets/editor/workspace-header";
import { useT } from "@/i18n/i18n-provider";

interface SpreadsheetWorkspaceProps {
  document: SpreadsheetDocument;
  editable: boolean;
  // Reads the saved version again and opens it in place of the screen.
  onReload: () => void;
}

// One spreadsheet on screen: its header, the notice of a refused save and the editor. A
// workspace serves one reading of the spreadsheet; the name follows a rename made here.
export function SpreadsheetWorkspace({
  document,
  editable,
  onReload,
}: SpreadsheetWorkspaceProps) {
  const t = useT();
  const navigate = useNavigate();
  const create = useCreateSpreadsheet();
  const [name, setName] = useState(document.name);
  const [command, setCommand] = useState<DocumentCommand | null>(null);
  const save = useDocumentSave(document.id, document.version);

  function open(id: string) {
    void navigate({ to: "/spreadsheets/$id", params: { id } });
  }

  function handleKeepCopy() {
    const content = save.editor()?.snapshot();
    if (content === undefined) return;

    create
      .mutateAsync({
        name: t("spreadsheets.copyName", { name }),
        content,
      })
      .then((created) => {
        open(created.id);
      })
      .catch((caught: unknown) => {
        toast.show({ tone: "danger", title: errorText(caught, t) });
      });
  }

  function handleDownload(format: "xlsx" | "csv") {
    const editor = save.editor();
    if (editor === null) return;

    downloadDocument(editor, name, format).catch((caught: unknown) => {
      toast.show({ tone: "danger", title: errorText(caught, t) });
    });
  }

  function handleDone(done: DocumentCommand, result?: SpreadsheetSummary) {
    setCommand(null);

    if (done.kind === "rename" && result !== undefined) setName(result.name);

    if (done.kind === "delete") {
      toast.show({ tone: "success", title: t("spreadsheets.deleted") });
      void navigate({ to: "/spreadsheets" });
    }

    if (done.kind === "copy" && result !== undefined) open(result.id);
  }

  return (
    <Page
      className={styles.page}
      // bleed: the column of "full" stops at a measure, and the editor takes every pixel.
      width="bleed"
      fill
      scroll="self"
      inset={0}
    >
      <div className={styles.header}>
        <WorkspaceHeader
          name={name}
          status={save.status}
          editable={editable}
          onCommand={(kind) => {
            // A copy holds what the server stores, so the screen is saved first.
            save.saveNow();
            setCommand({ kind, document: { id: document.id, name } });
          }}
          onDownload={handleDownload}
        />
      </div>

      <PageBody flow="none">
        <div className={styles.workspace}>
          <div className={styles.notice}>
            <SaveNotice
              status={save.status}
              keeping={create.isPending}
              onSaveAgain={save.saveNow}
              onReload={onReload}
              onKeepCopy={handleKeepCopy}
            />
          </div>

          <div className={styles.editor}>
            <SpreadsheetEditor
              content={document.content}
              editable={editable}
              onChange={save.handleChange}
              onOpen={save.handleOpen}
              onClose={save.handleClose}
            />
          </div>
        </div>
      </PageBody>

      <DocumentDialogs
        command={command}
        onCancel={() => {
          setCommand(null);
        }}
        onDone={handleDone}
      />
    </Page>
  );
}
