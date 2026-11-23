import { useCallback, useEffect, useState } from "react";

import { useApi } from "@/api/api-context";
import { fetchSpreadsheet } from "@/features/spreadsheets/api";
import type { SpreadsheetDocument } from "@/features/spreadsheets/api";

interface Reading {
  // The spreadsheet and the opening the answer belongs to.
  key: string;
  document?: SpreadsheetDocument;
  error?: Error;
}

interface StoredDocument {
  // Changes with the spreadsheet and with each reload: the editor mounts again for a new key.
  key: string;
  document: SpreadsheetDocument | undefined;
  error: Error | undefined;
  // Reads the stored version again, after a refused save or a failed read.
  reload: () => void;
}

// Reads one spreadsheet when its page opens and again only when the reader asks.
export function useStoredDocument(id: string): StoredDocument {
  const api = useApi();
  const [opening, setOpening] = useState(0);
  const [reading, setReading] = useState<Reading | null>(null);

  const key = `${id}:${String(opening)}`;

  useEffect(() => {
    let left = false;

    fetchSpreadsheet(api, id)
      .then((document) => {
        if (!left) setReading({ key, document });
      })
      .catch((caught: unknown) => {
        if (!left)
          setReading({
            key,
            error: caught instanceof Error ? caught : new Error(),
          });
      });

    return () => {
      left = true;
    };
  }, [api, id, key]);

  const reload = useCallback(() => {
    setOpening((n) => n + 1);
  }, []);

  // An answer of an earlier opening is not the one on screen.
  const current = reading?.key === key ? reading : null;

  return {
    key,
    document: current?.document,
    error: current?.error,
    reload,
  };
}
