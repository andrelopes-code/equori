import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button, ButtonLink, IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { InlineMessage } from "@slotted/react/inline-message";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";
import { Page, PageBody, PageFooter } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderBack,
  PageHeaderHeading,
  PageHeaderNav,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { toast } from "@slotted/react/toast";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { accountsQuery } from "@/features/accounts";
import { payeesQuery, settingsQuery, useScale } from "@/features/setup";
import { tagsQuery, useCreateTransaction } from "@/features/transactions/api";
import { writeEntryForm } from "@/features/transactions/capture-store";
import { emptyDraft, inputFromDraft } from "@/features/transactions/entry-kind";
import type { EntryDraft, EntryKind } from "@/features/transactions/entry-kind";
import { draftProblems } from "@/features/transactions/entry-validation";
import {
  clearDraft,
  readDraft,
  writeDraft,
} from "@/features/transactions/form-draft";
import { TradeForm } from "@/features/transactions/trade-form";
import { useTradeEntry } from "@/features/transactions/use-trade-entry";
import {
  TransactionForm,
  fieldOf,
} from "@/features/transactions/transaction-form";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { compactQuery, useMediaQuery, wideQuery } from "@/ui/use-media-query";

const draftKey = "new";

export function NewTransactionPage() {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const navigate = useNavigate();
  const { account_id, kind } = useSearch({ from: "/_authed/transactions/new" });
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const tags = useQuery(tagsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const scale = useScale();
  const create = useCreateTransaction();
  const wide = useMediaQuery(wideQuery);
  const compact = useMediaQuery(compactQuery);

  const [draft, setDraft] = useState<EntryDraft>(
    () => readDraft(draftKey) ?? emptyDraft(today, account_id ?? null),
  );
  // A trade is built by the server from its own fields; the posting form holds the other kinds.
  const [investment, setInvestment] = useState<"trade" | null>(kind ?? null);
  const trade = useTradeEntry(account_id ?? null);
  const pickKind = (next: EntryKind) => {
    if (next === "trade") {
      setInvestment(next);
    } else if (next !== "investment_income") {
      setInvestment(null);
      setDraft({ ...draft, kind: next });
    }
  };
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  useEffect(() => {
    writeDraft(draftKey, draft);
  }, [draft]);
  useEffect(() => {
    writeEntryForm("form");
  }, []);

  const accountsById = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a])),
    [accounts.data],
  );
  const base = settings.data?.base_currency;
  const ready =
    investment === "trade"
      ? trade.view.ready
      : accounts.data !== undefined && base !== undefined && scale !== null;
  const pending = investment === "trade" ? trade.pending : create.isPending;

  const announce = (id: string, title: string) => {
    toast.show({
      tone: "success",
      title,
      actions: (
        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          onClick={() => {
            void navigate({ to: "/transactions/$id", params: { id } });
          }}
        >
          {t("entry.view")}
        </Button>
      ),
    });
  };

  const submitTrade = async (next: "list" | "another") => {
    const created = await trade.submit();
    if (created === null) return;
    if (next === "list") {
      void navigate({ to: "/transactions/$id", params: { id: created.id } });
      return;
    }
    announce(created.id, t("trade.created"));
    trade.reset();
  };

  const submit = async (next: "list" | "another") => {
    if (investment === "trade") {
      await submitTrade(next);
      return;
    }
    const problems = draftProblems(draft);
    if (Object.keys(problems).length > 0) {
      setErrors(
        Object.fromEntries(
          Object.entries(problems).map(([field, key]) => [field, t(key)]),
        ),
      );
      setSummary(t("entry.fixFields"));
      return;
    }
    if (base === undefined) return;
    setErrors({});
    setSummary(null);
    try {
      const created = await create.mutateAsync(
        inputFromDraft(draft, accountsById, base),
      );
      clearDraft(draftKey);
      announce(created.id, t("entry.created"));
      if (next === "list") {
        void navigate({ to: "/transactions" });
      } else {
        // The next entry keeps how and where money moved, and when.
        setDraft({
          ...emptyDraft(draft.date, draft.accountId),
          kind: draft.kind,
          toAccountId: draft.toAccountId,
        });
      }
    } catch (error) {
      if (error instanceof ProblemError) {
        const byField = fieldErrors(error.problem);
        setErrors(
          Object.fromEntries(
            Object.entries(byField).map(([field, message]) => [
              fieldOf(draft.kind, field),
              message,
            ]),
          ),
        );
      }
      setSummary(errorText(error, t));
    }
  };

  const discard = () => {
    trade.discard();
    clearDraft(draftKey);
    void navigate({ to: "/transactions" });
  };
  const saveAnother = () => {
    void submit("another");
  };
  const save = (
    <Button
      fullWidth={compact}
      disabled={!ready}
      loading={pending}
      aria-keyshortcuts="Control+Enter"
      onClick={() => {
        void submit("list");
      }}
    >
      {t("entry.save")}
    </Button>
  );

  return (
    <Page
      width="wide"
      footer={
        <PageFooter>
          <ActionBar aria-label={t("entry.actions")}>
            <ActionBarActions>
              {compact ? (
                // Workaround for Slotted finding "Action-bar stacks every action below 24rem and
                // hides its overflow": stacked, the three actions took a fifth of a phone's
                // screen. Save fills the bar's one row; Discard and Save another wait in a menu.
                <ActionBarAction>
                  <Inline gap={2} wrap="nowrap">
                    <Menu>
                      <MenuTrigger
                        render={(props) => (
                          <IconButton
                            {...props}
                            aria-label={t("entry.moreActions")}
                            variant="outline"
                            tone="secondary"
                          >
                            <Icon>
                              <Glyph name="ellipsis" />
                            </Icon>
                          </IconButton>
                        )}
                      />
                      <MenuContent>
                        <MenuItem onSelect={discard}>
                          {t("entry.discard")}
                        </MenuItem>
                        <MenuItem disabled={!ready} onSelect={saveAnother}>
                          {t("entry.saveAnother")}
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                    {save}
                  </Inline>
                </ActionBarAction>
              ) : (
                <>
                  <ActionBarAction>
                    <Button variant="ghost" tone="secondary" onClick={discard}>
                      {t("entry.discard")}
                    </Button>
                  </ActionBarAction>
                  <ActionBarAction>
                    <Button
                      variant="outline"
                      tone="secondary"
                      disabled={!ready}
                      loading={pending}
                      onClick={saveAnother}
                    >
                      {t("entry.saveAnother")}
                    </Button>
                  </ActionBarAction>
                  <ActionBarAction>{save}</ActionBarAction>
                </>
              )}
            </ActionBarActions>
          </ActionBar>
        </PageFooter>
      }
    >
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          {/* Below 1024 px the shell's top app bar carries the way back. */}
          {wide && (
            <PageHeaderNav>
              <PageHeaderBack
                render={(props) => <Link {...props} to="/transactions" />}
              >
                {t("nav.transactions")}
              </PageHeaderBack>
            </PageHeaderNav>
          )}
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.new")}</PageHeaderHeading>
            </PageHeaderTitle>
            <PageHeaderActions>
              <ButtonLink
                variant="outline"
                tone="secondary"
                href="/transactions/capture"
                // Workaround for Slotted finding "ButtonLink render props cannot be spread onto a
                // router link": the anchor keeps its href for a modified click, and a plain click
                // navigates inside the application.
                onClick={(event) => {
                  if (
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  event.preventDefault();
                  void navigate({ to: "/transactions/capture" });
                }}
              >
                {t("capture.useText")}
              </ButtonLink>
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <form
          noValidate
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void submit("list");
            }
          }}
          onSubmit={(event) => {
            event.preventDefault();
            void submit("list");
          }}
        >
          {(investment === "trade" ? trade.summary : summary) !== null && (
            <InlineMessage tone="danger">
              {investment === "trade" ? trade.summary : summary}
            </InlineMessage>
          )}
          {ready && investment === "trade" && scale !== null && (
            <TradeForm
              draft={trade.draft}
              onChange={trade.setDraft}
              view={trade.view}
              errors={trade.errors}
              scale={scale}
              onKind={pickKind}
            />
          )}
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
