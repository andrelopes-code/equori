type EditorModule =
  typeof import("@/features/spreadsheets/editor/create-editor");

let editorModule: Promise<EditorModule> | undefined;

// The chunk of the editor, requested once. A failed request is forgotten, so the next opening
// asks again.
export function loadEditor(): Promise<EditorModule> {
  editorModule ??= import("@/features/spreadsheets/editor/create-editor").catch(
    (caught: unknown) => {
      editorModule = undefined;
      throw caught;
    },
  );

  return editorModule;
}

// Starts the request of the chunk before a spreadsheet opens: megabytes of script that the
// reader would otherwise wait for in front of an empty page. A failure is left to the opening.
export function preloadEditor(): void {
  loadEditor().catch(() => undefined);
}
