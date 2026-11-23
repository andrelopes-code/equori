import { LoadingOverlay } from "@slotted/react/loading-overlay";
import { useEffect, useRef, useState } from "react";

import type { SpreadsheetContent } from "@/features/spreadsheets/api";
import type { Editor } from "@/features/spreadsheets/editor/create-editor";
import styles from "@/features/spreadsheets/editor/spreadsheet-editor.module.css";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { useScheme } from "@/theme/scheme";
import { QueryError } from "@/ui/feedback/query-error";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

interface SpreadsheetEditorProps {
  content: SpreadsheetContent;
  editable: boolean;
  onChange: () => void;
  // The editor stands on screen.
  onOpen: (editor: Editor) => void;
  // The editor leaves the screen; it still answers snapshot during the call.
  onClose: (editor: Editor) => void;
}

// The grid, the toolbar, the formula bar and the sheet tabs of one spreadsheet. The editor is a
// chunk of its own, loaded when a spreadsheet opens.
export function SpreadsheetEditor({
  content,
  editable,
  onChange,
  onOpen,
  onClose,
}: SpreadsheetEditorProps) {
  const t = useT();
  const { language, tag } = useAppLocaleState();
  const [scheme] = useScheme();
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<Editor | null>(null);
  const [state, setState] = useState<"loading" | "ready" | Error>("loading");
  const [attempt, setAttempt] = useState(0);
  const change = useStableCallback(onChange);
  const open = useStableCallback(onOpen);
  const close = useStableCallback(onClose);

  useEffect(() => {
    const container = host.current;
    if (container === null) return;

    let left = false;

    loadEditor()
      .then(({ createEditor }) =>
        createEditor({
          container,
          content,
          editable,
          dark: isDark(),
          language,
          localeTag: tag,
          onChange: change,
        }),
      )
      .then((created) => {
        if (left) {
          created.dispose();
          return;
        }

        editor.current = created;
        open(created);
        setState("ready");
      })
      .catch((caught: unknown) => {
        if (!left) setState(caught instanceof Error ? caught : new Error());
      });

    return () => {
      left = true;

      const mounted = editor.current;
      if (mounted === null) return;

      editor.current = null;
      close(mounted);
      mounted.dispose();
    };
  }, [content, editable, language, tag, attempt, change, open, close]);

  useEffect(() => {
    editor.current?.setDark(isDark());
  }, [scheme, state]);

  if (state instanceof Error)
    return (
      <QueryError
        error={state}
        onRetry={() => {
          setState("loading");
          setAttempt((n) => n + 1);
        }}
      />
    );

  return (
    <LoadingOverlay
      className={styles.frame}
      loading={state === "loading"}
      messages={{ label: t("spreadsheets.loading") }}
    >
      <div ref={host} className={styles.host} />
    </LoadingOverlay>
  );
}

// The scheme in force on the document, after "system" is resolved.
function isDark(): boolean {
  return document.documentElement.dataset.slottedScheme === "dark";
}

type EditorModule =
  typeof import("@/features/spreadsheets/editor/create-editor");

let editorModule: Promise<EditorModule> | undefined;

// The chunk of the editor, requested once. A failed request is forgotten, so the next opening
// asks again.
function loadEditor(): Promise<EditorModule> {
  editorModule ??= import("@/features/spreadsheets/editor/create-editor").catch(
    (caught: unknown) => {
      editorModule = undefined;
      throw caught;
    },
  );

  return editorModule;
}
