import type { UploadFile } from "@slotted/core/upload";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import {
  accountQuery,
  csvProfileQuery,
  useImportFile,
  useSaveCsvProfile,
} from "@/features/accounts/api";
import {
  guessProfile,
  readyProfile,
  sameProfile,
} from "@/features/accounts/csv-guess";
import type { ProfileDraft } from "@/features/accounts/csv-guess";
import { countCsv, previewCsv } from "@/features/accounts/csv-preview";
import { readText } from "@/features/accounts/read-file";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

// The state of one import: the chosen file, its format, the text of a CSV file and the profile
// the person edits over the saved one or the guess.
export function useImportDraft(id: string) {
  const t = useT();
  const api = useApi();
  const navigate = useNavigate();
  const scale = useScale();
  const account = useQuery(accountQuery(api, id));
  const saved = useQuery(csvProfileQuery(api, id));
  const save = useSaveCsvProfile();
  const send = useImportFile();
  const [files, setFiles] = useState<readonly UploadFile[]>([]);
  const [format, setFormat] = useState<"ofx" | "csv">("ofx");
  const [text, setText] = useState<string | null>(null);
  const [edited, setEdited] = useState<ProfileDraft | null>(null);
  const reading = useRef<File | undefined>(undefined);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = files.find((f) => f.status !== "rejected")?.file;

  // The draft the reader starts from: the saved profile, else what the file's header suggests.
  const initial = useMemo(
    () =>
      text === null || saved.isPending
        ? null
        : (saved.data ?? guessProfile(text)),
    [text, saved.isPending, saved.data],
  );
  const draft = edited ?? initial;
  const read = (chosen: File | undefined, as: "ofx" | "csv") => {
    setText(null);
    if (chosen === undefined || as !== "csv") return;
    reading.current = chosen;
    void readText(chosen, saved.data?.encoding).then((content) => {
      // A later choice wins over a read still on its way.
      if (reading.current === chosen) setText(content);
    });
  };

  const profile = useMemo(
    () => (text === null || draft === null ? null : readyProfile(text, draft)),
    [text, draft],
  );
  const currency = account.data?.currency;
  const preview = useMemo(
    () =>
      text === null ||
      draft === null ||
      scale === null ||
      currency === undefined
        ? null
        : previewCsv(text, draft, scale(currency)),
    [text, draft, scale, currency],
  );
  const counts = useMemo(
    () =>
      text === null ||
      draft === null ||
      scale === null ||
      currency === undefined
        ? null
        : countCsv(text, draft, scale(currency)),
    [text, draft, scale, currency],
  );
  const csv =
    format === "csv" &&
    text !== null &&
    draft !== null &&
    preview !== null &&
    counts !== null &&
    currency !== undefined
      ? { text, draft, preview, counts, currency }
      : null;
  const ready = file !== undefined && (format === "ofx" || profile !== null);
  const busy = save.isPending || send.isPending;

  const submit = async () => {
    if (file === undefined) return;
    setError(null);
    try {
      if (format === "csv") {
        if (profile === null) return;
        if (!sameProfile(saved.data, profile)) {
          await save.mutateAsync({ id, profile });
        }
      }
      const batch = await send.mutateAsync({ accountId: id, format, file });
      void navigate({
        to: "/accounts/$id/imports/$batchId",
        params: { id, batchId: batch.id },
      });
    } catch (caught) {
      setError(errorText(caught, t));
    }
  };

  const changeFiles = (next: readonly UploadFile[]) => {
    setFiles(next);
    setEdited(null);
    setError(null);
    const kept = next.find((f) => f.status !== "rejected");
    if (kept !== undefined) {
      setRefusal(null);
      setFormat(formatOf(kept.name));
    }
    read(kept?.file, kept === undefined ? "ofx" : formatOf(kept.name));
  };

  const rejectFiles = (rejected: readonly UploadFile[]) => {
    const reason = rejected[0]?.reason;
    setRefusal(
      reason === "size" ? t("importFile.tooLarge") : t("importFile.wrongType"),
    );
  };

  const changeFormat = (next: "ofx" | "csv") => {
    setFormat(next);
    setEdited(null);
    read(file, next);
  };

  return {
    account,
    file,
    files,
    format,
    scale,
    csv,
    ready,
    busy,
    refusal,
    error,
    setEdited,
    submit,
    changeFiles,
    rejectFiles,
    changeFormat,
  };
}

function formatOf(name: string): "ofx" | "csv" {
  return name.toLowerCase().endsWith(".csv") ? "csv" : "ofx";
}
