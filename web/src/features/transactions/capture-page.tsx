import { Page, PageBody } from "@slotted/react/page";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { payeesQuery, settingsQuery, useScale } from "@/features/setup";
import { tagsQuery } from "@/features/transactions/api";
import { openDefaultAccount } from "@/features/transactions/capture-default-account";
import type {
  LineDraft,
  LineOverride,
} from "@/features/transactions/capture-draft";
import { CaptureDrafts } from "@/features/transactions/capture-drafts";
import { CaptureEditDialog } from "@/features/transactions/capture-edit-dialog";
import { CaptureFooter } from "@/features/transactions/capture-footer";
import { CaptureHeader } from "@/features/transactions/capture-header";
import styles from "@/features/transactions/capture-page.module.css";
import { captureSetup } from "@/features/transactions/capture-setup";
import { CaptureWriter } from "@/features/transactions/capture-writer";
import { useCaptureReading } from "@/features/transactions/use-capture-reading";
import { useCaptureSubmit } from "@/features/transactions/use-capture-submit";
import { useCaptureText } from "@/features/transactions/use-capture-text";
import { useToday } from "@/i18n/today";

// A115: the owner writes one transaction per line; each line becomes a draft beside the text,
// and Record writes every draft in one batch or none (A114).
export function CapturePage() {
  const api = useApi();
  const today = useToday();
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const tags = useQuery(tagsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const scale = useScale();
  const capture = useCaptureText();

  const [editing, setEditing] = useState<number | null>(null);

  const accountsById = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a])),
    [accounts.data],
  );
  const payeeNames = useMemo(
    () => new Map((payees.data ?? []).map((p) => [p.id, p.name])),
    [payees.data],
  );
  const defaultAccount = openDefaultAccount(
    capture.defaultAccountId,
    accountsById,
  );
  const { preview, empty, current, keys, rows, attention } = useCaptureReading({
    text: capture.text,
    overrides: capture.overrides,
    setOverrides: capture.setOverrides,
    defaultAccount,
    capturedOn: capture.entry?.capturedOn ?? null,
    accountsById,
    accountsLoaded: accounts.data !== undefined,
  });
  const setup = captureSetup(
    accounts.data,
    settings.data?.base_currency,
    scale,
  );
  const { submit, dismiss, dismissRefusal, summary, refusal, pending } =
    useCaptureSubmit({
      rows,
      setup,
      current,
      attention,
      entry: capture.entry,
      accountsById,
      onRecorded: handleRecorded,
    });
  const editingRow = editing === null ? undefined : rows[editing];

  function setOverride(index: number, next: LineOverride) {
    const key = keys[index];
    if (key === undefined) return;

    dismissRefusal();
    capture.setOverrides((o) => ({ ...o, [key]: next }));
  }

  function handleTextChange(value: string) {
    capture.setText(value);
    dismiss();
  }

  function handleRecorded() {
    capture.setText("");
    capture.setOverrides({});
  }

  function handleClear() {
    handleRecorded();
    dismiss();
  }

  function handleApply(index: number, key: string, draft: LineDraft) {
    setOverride(index, { ...capture.overrides[key], edited: draft });
    setEditing(null);
  }

  return (
    <Page
      width="wide"
      footer={
        <CaptureFooter
          count={rows.length}
          clearDisabled={empty}
          recordDisabled={setup === null || !current || rows.length === 0}
          pending={pending}
          onClear={handleClear}
          onRecord={() => {
            void submit();
          }}
        />
      }
    >
      <CaptureHeader queuedOn={capture.entry?.capturedOn} />

      <PageBody>
        <div className={styles.layout}>
          <CaptureWriter
            setup={setup}
            defaultAccount={defaultAccount}
            date={capture.entry?.capturedOn ?? today}
            text={capture.text}
            busy={(!empty && !current) || pending}
            onDefaultAccountChange={capture.chooseDefaultAccount}
            onTextChange={handleTextChange}
            onRecord={() => {
              void submit();
            }}
          />

          <CaptureDrafts
            rows={rows}
            attention={attention}
            loading={!empty && !current}
            summary={summary}
            error={preview.isError ? preview.error : null}
            refusal={refusal}
            setup={setup}
            accountsById={accountsById}
            payeeNames={payeeNames}
            overrides={capture.overrides}
            onOverride={setOverride}
            onEdit={setEditing}
          />
        </div>

        {editingRow !== undefined && editing !== null && setup !== null && (
          <CaptureEditDialog
            lineNumber={editingRow.line.line}
            initial={editingRow.draft}
            accounts={setup.accounts}
            accountsById={accountsById}
            payees={payees.data ?? []}
            tags={tags.data ?? []}
            baseCurrency={setup.base}
            scale={setup.scale}
            onApply={(draft) => {
              handleApply(editing, editingRow.key, draft);
            }}
            onClose={() => {
              setEditing(null);
            }}
          />
        )}
      </PageBody>
    </Page>
  );
}
