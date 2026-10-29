import type { UploadFile } from "@slotted/core/upload";
import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Inline } from "@slotted/react/inline";
import { Page, PageBody, PageFooter } from "@slotted/react/page";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Stack } from "@slotted/react/stack";
import { Upload } from "@slotted/react/upload";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { AccountFormHeader } from "@/features/accounts/account-form-header";
import {
  accountQuery,
  csvProfileQuery,
  useImportFile,
  useSaveCsvProfile,
} from "@/features/accounts/api";
import { completeProfile, guessProfile } from "@/features/accounts/csv-guess";
import type { ProfileDraft } from "@/features/accounts/csv-guess";
import { previewCsv } from "@/features/accounts/csv-preview";
import { readText } from "@/features/accounts/read-file";
import { CsvPreviewTable } from "@/features/accounts/csv-preview-table";
import { CsvProfileSection } from "@/features/accounts/csv-profile-section";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { FormLayout } from "@/ui/form-layout";

// P4 amendment A16: the server takes a statement of at most 10 MiB.
const maxBytes = 10 * 1024 * 1024;

function formatOf(name: string): "ofx" | "csv" {
  return name.toLowerCase().endsWith(".csv") ? "csv" : "ofx";
}

// A statement file into a balance account: an OFX file as it is, a CSV file through the
// account's profile, previewed line by line before anything is sent.
export function ImportPage() {
  const t = useT();
  const api = useApi();
  const navigate = useNavigate();
  const scale = useScale();
  const { id } = useParams({ from: "/_authed/accounts/$id/import" });
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
    void readText(chosen).then((content) => {
      // A later choice wins over a read still on its way.
      if (reading.current === chosen) setText(content);
    });
  };

  const profile = draft === null ? null : completeProfile(draft);
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
  const csv =
    format === "csv" &&
    draft !== null &&
    preview !== null &&
    currency !== undefined;
  const ready = file !== undefined && (format === "ofx" || profile !== null);
  const busy = save.isPending || send.isPending;

  const submit = async () => {
    if (file === undefined) return;
    setError(null);
    try {
      if (format === "csv") {
        if (profile === null) return;
        if (JSON.stringify(saved.data) !== JSON.stringify(profile)) {
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

  return (
    <Page
      width="wide"
      footer={
        <PageFooter>
          <ActionBar aria-label={t("importFile.actions")}>
            <ActionBarActions>
              <ActionBarAction>
                <Button
                  variant="ghost"
                  tone="secondary"
                  onClick={() => {
                    void navigate({ to: "/accounts/$id", params: { id } });
                  }}
                >
                  {t("detail.cancel")}
                </Button>
              </ActionBarAction>
              <ActionBarAction>
                <Button
                  disabled={!ready}
                  loading={busy}
                  onClick={() => void submit()}
                >
                  {t("importFile.submit")}
                </Button>
              </ActionBarAction>
            </ActionBarActions>
          </ActionBar>
        </PageFooter>
      }
    >
      <AccountFormHeader
        title={t("importFile.title")}
        subtitle={
          account.data === undefined
            ? t("importFile.subtitle")
            : t("importFile.subtitleOf", { name: account.data.name })
        }
        back={{ to: "/accounts/$id", params: { id } }}
        backLabel={account.data?.name ?? t("nav.accounts")}
      />
      <PageBody>
        <Stack gap={10}>
          <FormLayout>
            <Field required invalid={refusal !== null || error !== null}>
              <FieldLabel>{t("importFile.file")}</FieldLabel>
              <Upload
                accept=".ofx,.csv,text/csv,application/x-ofx"
                maxSize={maxBytes}
                // A statement has no thumbnail and no in-browser view worth opening.
                preview="none"
                view="none"
                files={files}
                description={t("importFile.fileHint")}
                onFilesChange={(next) => {
                  setFiles(next);
                  setEdited(null);
                  setError(null);
                  const kept = next.find((f) => f.status !== "rejected");
                  if (kept !== undefined) {
                    setRefusal(null);
                    setFormat(formatOf(kept.name));
                  }
                  read(
                    kept?.file,
                    kept === undefined ? "ofx" : formatOf(kept.name),
                  );
                }}
                onReject={(rejected) => {
                  const reason = rejected[0]?.reason;
                  setRefusal(
                    reason === "size"
                      ? t("importFile.tooLarge")
                      : t("importFile.wrongType"),
                  );
                }}
              />
              {(refusal ?? error) !== null && (
                <FieldError>{refusal ?? error}</FieldError>
              )}
            </Field>

            {file !== undefined && (
              <FieldGroup required>
                <FieldGroupLegend>{t("importFile.format")}</FieldGroupLegend>
                <FieldGroupContent>
                  <Inline>
                    <SegmentedControl
                      aria-label={t("importFile.format")}
                      value={format}
                      onValueChange={(next) => {
                        if (next === "ofx" || next === "csv") {
                          setFormat(next);
                          setEdited(null);
                          read(file, next);
                        }
                      }}
                    >
                      <Segment value="ofx">{t("importFile.ofx")}</Segment>
                      <Segment value="csv">{t("importFile.csv")}</Segment>
                    </SegmentedControl>
                  </Inline>
                </FieldGroupContent>
              </FieldGroup>
            )}
            {csv && (
              <CsvProfileSection
                value={draft}
                onChange={setEdited}
                headers={preview.headers}
              />
            )}
          </FormLayout>

          {csv && (
            <Stack gap={2}>
              <CsvPreviewTable
                preview={preview}
                currency={currency}
                scale={scale === null ? 2 : scale(currency)}
              />
              {preview.problem !== null && (
                <FieldError>
                  {t("importFile.missingColumn", {
                    column: preview.problem.column,
                  })}
                </FieldError>
              )}
            </Stack>
          )}
        </Stack>
      </PageBody>
    </Page>
  );
}
