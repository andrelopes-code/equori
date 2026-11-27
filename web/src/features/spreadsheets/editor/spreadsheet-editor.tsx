import { useEffect, useRef, useState } from "react";

import type { SpreadsheetContent } from "@/features/spreadsheets/api";
import { useChartTexts } from "@/features/spreadsheets/charts/use-chart-texts";
import type { Editor } from "@/features/spreadsheets/editor/create-editor";
import { loadEditor } from "@/features/spreadsheets/editor/load-editor";
import styles from "@/features/spreadsheets/editor/spreadsheet-editor.module.css";
import { SpreadsheetPlaceholder } from "@/features/spreadsheets/editor/spreadsheet-placeholder";
import { useAppLocaleState } from "@/i18n/i18n-provider";
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
  const { language, tag } = useAppLocaleState();
  const [scheme] = useScheme();
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<Editor | null>(null);
  const drawnDark = useRef(false);
  const [state, setState] = useState<"loading" | "ready" | Error>("loading");
  const [attempt, setAttempt] = useState(0);
  // The grid is on screen; the editor is created before it draws.
  const [drawn, setDrawn] = useState(false);
  const texts = useChartTexts();
  const change = useStableCallback(onChange);
  const open = useStableCallback(onOpen);
  const close = useStableCallback(onClose);

  useEffect(() => {
    const container = host.current;
    if (container === null) return;

    const leaving = new AbortController();
    const { signal } = leaving;
    const dark = isDark();

    loadEditor()
      .then(({ createEditor }) =>
        createEditor({
          container,
          signal,
          content,
          editable,
          dark,
          language,
          localeTag: tag,
          chartTexts: texts,
          onChange: change,
          onRendered: () => {
            setDrawn(true);
          },
        }),
      )
      .then((created) => {
        if (signal.aborted) {
          created.dispose();
          return;
        }

        editor.current = created;
        drawnDark.current = dark;
        open(created);
        setState("ready");
      })
      .catch((caught: unknown) => {
        if (!signal.aborted)
          setState(caught instanceof Error ? caught : new Error());
      });

    return () => {
      leaving.abort();

      const mounted = editor.current;
      if (mounted === null) return;

      editor.current = null;
      close(mounted);
      mounted.dispose();
    };
  }, [content, editable, language, tag, texts, attempt, change, open, close]);

  useEffect(() => {
    const dark = isDark();

    // An editor opens in the scheme in force; only a later change of scheme is applied.
    if (editor.current !== null && drawnDark.current !== dark) {
      drawnDark.current = dark;
      editor.current.setDark(dark);
    }
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
    <div className={styles.frame} aria-busy={!drawn}>
      <div ref={host} className={styles.host} />

      {!drawn && <SpreadsheetPlaceholder />}
    </div>
  );
}

// The scheme in force on the document, after "system" is resolved.
function isDark(): boolean {
  return document.documentElement.dataset.slottedScheme === "dark";
}
