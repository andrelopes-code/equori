import { useEffect, useState } from "react";

import { ProblemError } from "@/api/problem";
import { useSaveSpreadsheet } from "@/features/spreadsheets/api";
import type {
  SpreadsheetContent,
  SpreadsheetSummary,
} from "@/features/spreadsheets/api";
import type { Editor } from "@/features/spreadsheets/editor/create-editor";
import { Autosaver } from "@/features/spreadsheets/model/autosaver";
import type { SaveStatus } from "@/features/spreadsheets/model/autosaver";

// The pause in the changes after which the content is saved.
const saveDelay = 1500;

type Save = (
  id: string,
  content: SpreadsheetContent,
  version: number,
) => Promise<SpreadsheetSummary>;

interface DocumentSave {
  status: SaveStatus;
  // The editor on screen, or null before it opens and after it closes.
  editor: () => Editor | null;
  handleOpen: (editor: Editor) => void;
  handleChange: () => void;
  handleClose: () => void;
  saveNow: () => void;
}

// Saves one spreadsheet as the reader edits it: after each pause, on Ctrl+S or Cmd+S, and when
// the editor closes. The browser asks before it leaves a page that holds an unsaved change.
// id and version are read once: a workspace serves one spreadsheet.
export function useDocumentSave(id: string, version: number): DocumentSave {
  const save = useSaveSpreadsheet();
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [session] = useState(() => newSession(id, version, save, setStatus));

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s")
        return;

      event.preventDefault();
      session.saveNow();
    }

    function handleLeave(event: BeforeUnloadEvent) {
      if (session.dirty()) event.preventDefault();
    }

    window.addEventListener("keydown", handleKey, true);
    window.addEventListener("beforeunload", handleLeave);

    return () => {
      window.removeEventListener("keydown", handleKey, true);
      window.removeEventListener("beforeunload", handleLeave);
    };
  }, [session]);

  return { status, ...session.handlers };
}

// The editor, the stored version and the saver of one open spreadsheet.
function newSession(
  id: string,
  version: number,
  save: Save,
  onStatus: (status: SaveStatus) => void,
) {
  let editor: Editor | null = null;
  let stored = version;

  const saver = new Autosaver({
    delay: saveDelay,
    save: async () => {
      // The snapshot is read before the first await: a save started while the editor closes
      // still holds the content.
      const content = editor?.snapshot();
      if (content === undefined) return;

      stored = (await save(id, content, stored)).version;
    },
    isConflict: (error) =>
      error instanceof ProblemError &&
      error.problem.code === "version_conflict",
    onStatus,
  });

  function saveNow() {
    void saver.flush();
  }

  return {
    dirty: () => saver.dirty,
    saveNow,
    handlers: {
      editor: () => editor,
      handleOpen: (opened: Editor) => {
        editor = opened;
      },
      handleChange: () => {
        saver.touch();
      },
      handleClose: () => {
        saveNow();
        editor = null;
      },
      saveNow,
    },
  };
}
