import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
  ActionBarOverflow,
} from "@slotted/react/action-bar";
import { Button, ButtonLink } from "@slotted/react/button";
import { InlineMessage } from "@slotted/react/inline-message";
import { MenuItem } from "@slotted/react/menu";
import { Page, PageBody, PageFooter } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
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
import {
  emptyDraft,
  inputFromDraft,
  isBuiltKind,
} from "@/features/transactions/entry-kind";
import type {
  BuiltKind,
  EntryDraft,
  EntryKind,
} from "@/features/transactions/entry-kind";
import { ExchangeForm } from "@/features/transactions/exchange-form";
import { ForeignForm } from "@/features/transactions/foreign-form";
import { draftProblems } from "@/features/transactions/entry-validation";
import {
  clearDraft,
  readDraft,
  writeDraft,
} from "@/features/transactions/form-draft";
import { IncomeForm } from "@/features/transactions/income-form";
import { TradeForm } from "@/features/transactions/trade-form";
import { useIncomeEntry } from "@/features/transactions/use-income-entry";
import { useExchangeEntry } from "@/features/transactions/use-exchange-entry";
import { useForeignEntry } from "@/features/transactions/use-foreign-entry";
import { useTradeEntry } from "@/features/transactions/use-trade-entry";
import {
  TransactionForm,
  fieldOf,
} from "@/features/transactions/transaction-form";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { compactQuery, useMediaQuery, wideQuery } from "@/ui/use-media-query";
import { PageBack } from "@/ui/page-back";

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
  // The kinds the server builds from their own fields; the posting form holds the others.
  const [investment, setInvestment] = useState<BuiltKind | null>(kind ?? null);
  const trade = useTradeEntry(account_id ?? null);
  const income = useIncomeEntry(account_id ?? null);
  const foreign = useForeignEntry(account_id ?? null);
  const exchange = useExchangeEntry(account_id ?? null);
  const entry =
    investment === "trade"
      ? trade
      : investment === "investment_income"
        ? income
        : investment === "foreign_purchase"
          ? foreign
          : investment === "exchange"
            ? exchange
            : null;
  const pickKind = (next: EntryKind) => {
    if (isBuiltKind(next)) {
      setInvestment(next);
    } else {
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
    entry !== null
      ? entry.view.ready
      : accounts.data !== undefined && base !== undefined && scale !== null;
  const pending = entry?.pending ?? create.isPending;

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

  const submitInvestment = async (
    next: "list" | "another",
    active: NonNullable<typeof entry>,
  ) => {
    const created = await active.submit();
    if (created === null) return;
    if (next === "list") {
      void navigate({ to: "/transactions/$id", params: { id: created.id } });
      return;
    }
    announce(
      created.id,
      t(
        active === trade
          ? "trade.created"
          : active === foreign
            ? "foreignPurchase.created"
            : active === exchange
              ? "exchange.created"
              : "income.created",
      ),
    );
    active.reset();
  };

  const submit = async (next: "list" | "another") => {
    if (entry !== null) {
      await submitInvestment(next, entry);
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
    income.discard();
    foreign.discard();
    exchange.discard();
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
              {/* On a phone the bar keeps one row: Save, and a menu with the other two. */}
              <ActionBarAction
                priority={compact ? "always" : "low"}
                counterpart={
                  <MenuItem onSelect={discard}>{t("entry.discard")}</MenuItem>
                }
              >
                <Button variant="ghost" tone="secondary" onClick={discard}>
                  {t("entry.discard")}
                </Button>
              </ActionBarAction>
              <ActionBarAction
                priority={compact ? "always" : "low"}
                counterpart={
                  <MenuItem disabled={!ready} onSelect={saveAnother}>
                    {t("entry.saveAnother")}
                  </MenuItem>
                }
              >
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
              <ActionBarOverflow label={t("entry.moreActions")} />
            </ActionBarActions>
          </ActionBar>
        </PageFooter>
      }
    >
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          {/* Below 1024 px the shell's top app bar carries the way back. */}
          {wide && (
            <PageBack
              render={(props) => <Link {...props} to="/transactions" />}
            >
              {t("nav.transactions")}
            </PageBack>
          )}
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.new")}</PageHeaderHeading>
            </PageHeaderTitle>
            <PageHeaderActions>
              <ButtonLink
                variant="outline"
                tone="secondary"
                render={(props) => (
                  <Link {...props} to="/transactions/capture" />
                )}
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
          {(entry?.summary ?? summary) !== null && (
            <InlineMessage tone="danger">
              {entry?.summary ?? summary}
            </InlineMessage>
          )}
          {ready && investment === "investment_income" && scale !== null && (
            <IncomeForm
              draft={income.draft}
              onChange={income.setDraft}
              view={income.view}
              errors={income.errors}
              scale={scale}
              onKind={pickKind}
            />
          )}
          {ready && investment === "exchange" && scale !== null && (
            <ExchangeForm
              draft={exchange.draft}
              onChange={exchange.setDraft}
              view={exchange.view}
              errors={exchange.errors}
              scale={scale}
              onKind={pickKind}
            />
          )}
          {ready && investment === "foreign_purchase" && scale !== null && (
            <ForeignForm
              draft={foreign.draft}
              onChange={foreign.setDraft}
              view={foreign.view}
              errors={foreign.errors}
              scale={scale}
              payees={payees.data ?? []}
              onKind={pickKind}
            />
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
