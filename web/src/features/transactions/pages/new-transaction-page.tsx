import { Page, PageBody } from "@slotted/react/page";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { payeesQuery, settingsQuery, useScale } from "@/features/setup";
import { tagsQuery } from "@/features/transactions/api";
import { writeEntryForm } from "@/features/transactions/capture-model/capture-store";
import {
  emptyDraft,
  isBuiltKind,
} from "@/features/transactions/entry-model/entry-kind";
import type {
  BuiltKind,
  EntryDraft,
  EntryKind,
} from "@/features/transactions/entry-model/entry-kind";
import {
  clearDraft,
  readDraft,
  writeDraft,
} from "@/features/transactions/entry-model/form-draft";
import { BuiltEntryForm } from "@/features/transactions/new-entry/built-entry-form";
import { draftKey } from "@/features/transactions/new-entry/draft-key";
import { NewEntryFooter } from "@/features/transactions/new-entry/new-entry-footer";
import { NewEntryHeader } from "@/features/transactions/new-entry/new-entry-header";
import { useBuiltEntries } from "@/features/transactions/new-entry/use-built-entries";
import { useSubmitEntry } from "@/features/transactions/new-entry/use-submit-entry";
import { useDestinationPreset } from "@/features/transactions/pages/use-destination-preset";
import { TransactionForm } from "@/features/transactions/transaction-form/transaction-form";
import { useToday } from "@/i18n/today";
import { FormNotice } from "@/ui/form-layout/form-notice";
import { useMediaQuery, wideQuery } from "@/ui/runtime/use-media-query";

export function NewTransactionPage() {
  const api = useApi();
  const today = useToday();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authed/transactions/new" });
  const { account_id, to_account_id, brokerage_id, instrument, kind } = search;
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const tags = useQuery(tagsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const scale = useScale();
  const wide = useMediaQuery(wideQuery);

  const [draft, setDraft] = useState<EntryDraft>(() => {
    const start = readDraft(draftKey) ?? emptyDraft(today, account_id ?? null);
    return kind === "transfer" ? { ...start, kind } : start;
  });
  // The kinds the server builds from their own fields; the posting form holds the others.
  const [investment, setInvestment] = useState<BuiltKind | null>(
    isBuiltKind(kind) ? kind : null,
  );
  useDestinationPreset(to_account_id, accounts.data, setDraft);
  const built = useBuiltEntries(
    investment,
    account_id ?? null,
    brokerage_id ?? null,
    instrument ?? null,
    search,
  );
  const { entry } = built;
  const { submit, errors, summary, creating } = useSubmitEntry({
    draft,
    setDraft,
    built,
    base: settings.data?.base_currency,
    accounts: accounts.data,
  });
  useEffect(() => {
    writeDraft(draftKey, draft);
  }, [draft]);
  useEffect(() => {
    writeEntryForm("form");
  }, []);

  const base = settings.data?.base_currency;
  const ready =
    entry !== null
      ? entry.view.ready
      : accounts.data !== undefined && base !== undefined && scale !== null;
  const pending = entry?.pending ?? creating;

  const pickKind = (next: EntryKind) => {
    if (isBuiltKind(next)) {
      setInvestment(next);
    } else {
      setInvestment(null);
      setDraft({ ...draft, kind: next });
    }
  };

  const discard = () => {
    built.discardAll();
    clearDraft(draftKey);
    void navigate({ to: "/transactions" });
  };
  const saveAnother = () => {
    void submit("another");
  };
  const saveAndClose = () => {
    void submit("list");
  };

  return (
    <Page
      width="wide"
      footer={
        <NewEntryFooter
          ready={ready}
          pending={pending}
          onDiscard={discard}
          onSaveAnother={saveAnother}
          onSave={saveAndClose}
        />
      }
    >
      <NewEntryHeader />

      <PageBody>
        <form
          noValidate
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              saveAndClose();
            }
          }}
          onSubmit={(event) => {
            event.preventDefault();
            saveAndClose();
          }}
        >
          {(entry?.summary ?? summary) !== null && (
            <FormNotice className="mb-6">
              {entry?.summary ?? summary}
            </FormNotice>
          )}

          <BuiltEntryForm
            investment={investment}
            ready={ready}
            scale={scale}
            payees={payees.data ?? []}
            entries={built}
            onKind={pickKind}
          />

          {ready &&
            investment === null &&
            base !== undefined &&
            scale !== null &&
            accounts.data !== undefined && (
              <TransactionForm
                draft={draft}
                onChange={setDraft}
                accounts={accounts.data}
                payees={payees.data ?? []}
                tags={tags.data ?? []}
                baseCurrency={base}
                scale={scale}
                errors={errors}
                // A phone would open its keyboard over the form before the reader chose to type.
                autoFocusAmount={wide}
                onInvestment={pickKind}
              />
            )}
        </form>
      </PageBody>
    </Page>
  );
}
