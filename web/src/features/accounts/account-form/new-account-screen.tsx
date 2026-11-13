import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { Page, PageBody, PageFooter } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import type { components } from "@/api/schema.gen";
import {
  clearAccountDraft,
  emptyAccountDraft,
  readAccountDraft,
  writeAccountDraft,
} from "@/features/accounts/model/account-draft";
import type { AccountDraft } from "@/features/accounts/model/account-draft";
import { AccountForm } from "@/features/accounts/account-form/account-form";
import { AccountFormHeader } from "@/features/accounts/account-form/account-form-header";
import type { AccountFormSearch } from "@/features/accounts/account-form/account-form-search";
import { AccountPreview } from "@/features/accounts/account-form/account-preview";
import { KindChooser } from "@/features/accounts/account-form/kind-chooser";
import {
  draftKey,
  useCreateAccountSubmit,
} from "@/features/accounts/account-form/use-create-account-submit";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { FormNotice } from "@/ui/form-layout/form-notice";
import { FormLayout } from "@/ui/form-layout/form-layout";

type Account = components["schemas"]["Account"];

export function NewAccountScreen({
  search,
  accounts,
  base,
  currencies,
  scale,
}: {
  search: AccountFormSearch;
  accounts: Account[];
  base: string;
  currencies: string[];
  scale: (code: string) => number;
}) {
  const t = useT();
  const today = useToday();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<AccountDraft>(() => {
    const stored = readAccountDraft(draftKey) ?? emptyAccountDraft(today, base);
    return {
      ...stored,
      ...(search.kind === undefined ? {} : { kind: search.kind }),
      ...(search.name !== undefined && stored.name === ""
        ? { name: search.name }
        : {}),
    };
  });
  const { submit, errors, summary, running } = useCreateAccountSubmit({
    draft,
    search,
    accounts,
  });
  useEffect(() => {
    writeAccountDraft(draftKey, draft);
  }, [draft]);

  return (
    <Page
      width="wide"
      footer={
        <PageFooter>
          <ActionBar aria-label={t("accountForm.actions")}>
            <ActionBarActions>
              <ActionBarAction>
                <Button
                  variant="ghost"
                  tone="secondary"
                  onClick={() => {
                    clearAccountDraft(draftKey);
                    void navigate({ to: "/accounts" });
                  }}
                >
                  {t("accountForm.discard")}
                </Button>
              </ActionBarAction>
              <ActionBarAction>
                <Button
                  disabled={draft.kind === null}
                  loading={running}
                  onClick={() => void submit()}
                >
                  {t("accountForm.create")}
                </Button>
              </ActionBarAction>
            </ActionBarActions>
          </ActionBar>
        </PageFooter>
      }
    >
      <AccountFormHeader
        title={t("accountForm.newTitle")}
        subtitle={t("accountForm.newSubtitle")}
        back={{ to: "/accounts" }}
        backLabel={t("nav.accounts")}
      />
      <PageBody>
        {draft.kind === null ? (
          <KindChooser
            value={draft.kind}
            onChange={(kind) => {
              setDraft({ ...draft, kind });
            }}
          />
        ) : (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Stack gap={6}>
              {summary !== null && <FormNotice>{summary}</FormNotice>}
              <FormLayout
                aside={<AccountPreview draft={draft} scale={scale} />}
              >
                <AccountForm
                  mode="create"
                  draft={draft}
                  onChange={setDraft}
                  onChangeKind={() => {
                    setDraft({ ...draft, kind: null });
                  }}
                  accounts={accounts}
                  base={base}
                  currencies={currencies}
                  scale={scale}
                  errors={errors}
                />
              </FormLayout>
            </Stack>
          </form>
        )}
      </PageBody>
    </Page>
  );
}
