import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@slotted/react/dialog";
import { Kbd } from "@slotted/react/kbd";
import { useRef, useState } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { settingsQuery, useScale } from "@/features/setup";
import { saveDraft } from "@/features/transactions/draft-storage";
import styles from "@/features/transactions/quick-entry.module.css";
import { parseEntry } from "@/features/transactions/quick-entry-parse";
import { initialForm } from "@/features/transactions/transaction-form-reducer";
import type { FormState } from "@/features/transactions/transaction-form-reducer";
import { useBalanceAfter } from "@/features/transactions/use-balance-after";
import { useQuickEntryPost } from "@/features/transactions/use-quick-entry-post";
import { formatDayMonth, formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { ChoiceChips } from "@/ui/choice-chips";
import { InkButton } from "@/ui/ink-button";
import { useViewport } from "@/ui/use-viewport";

const examples = [
  "entry.example.1",
  "entry.example.2",
  "entry.example.3",
] as const;

// Complete frontend F2: one line of free text becomes a transaction. The parse shows as a
// ledger line before it posts; a category chosen by hand outlives the next keystrokes.
export function QuickEntry({
  open,
  onOpenChange,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The account open on screen, posted to unless the text names another.
  accountId?: string | undefined;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
  const navigate = useNavigate();
  const phone = useViewport() === "phone";
  const field = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const scaleOf = useScale();
  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const { post, pending } = useQuickEntryPost();

  const base = settings.data?.base_currency ?? "";
  const scale = scaleOf?.(base) ?? 2;
  const all = (accounts.data ?? []).filter((a) => a.closed_on === undefined);
  const parse = parseEntry(text, {
    today,
    scale,
    accounts: all,
    defaultAccountId: accountId,
  });
  const categoryClass = parse.mode === "income" ? "income" : "expense";
  const categories = all.filter((a) => a.class === categoryClass);
  const categoryId =
    chosen !== null && categories.some((c) => c.id === chosen)
      ? chosen
      : parse.categoryId;
  const account = all.find((a) => a.id === parse.accountId);
  const impact = useBalanceAfter({
    accountId: parse.accountId,
    mode: parse.mode,
    amount: parse.amount,
    enabled: open,
  });
  const currencyOf = (id: string) =>
    all.find((a) => a.id === id)?.currency ?? base;
  const money = (amount: number, currency = base) =>
    formatMoney({ amount, currency }, scaleOf?.(currency) ?? scale, locale);

  const state = (): FormState => ({
    ...initialForm(today, parse.accountId ?? ""),
    mode: parse.mode,
    amount: parse.amount,
    counterId: categoryId ?? "",
    date: parse.date,
    description: parse.description,
  });

  const reset = () => {
    setText("");
    setChosen(null);
    setMissing(false);
  };

  const submit = async () => {
    if (pending) return;
    if (parse.amount === null) {
      setMissing(true);
      return;
    }
    if (parse.accountId === null || categoryId === null) return;
    const done = t("entry.done", {
      description: parse.description || (account?.name ?? ""),
      amount: money(parse.amount, account?.currency ?? base),
    });
    if (await post(state(), currencyOf, done)) {
      reset();
      onOpenChange(false);
    }
  };

  const more = () => {
    saveDraft(state());
    reset();
    onOpenChange(false);
    void navigate({ to: "/transactions/new" });
  };

  const when =
    parse.dateWord === "yesterday"
      ? t("entry.yesterday", { date: formatDayMonth(parse.date, locale) })
      : parse.date === today
        ? t("entry.today", { date: formatDayMonth(parse.date, locale) })
        : formatDayMonth(parse.date, locale);

  const note =
    missing && parse.amount === null
      ? "missing"
      : impact === null
        ? "hint"
        : "impact";
  const empty = t("entry.empty");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      size="lg"
      placement="top"
      fullScreen={phone ? "always" : "never"}
      initialFocus={field}
    >
      <DialogContent>
        <form
          data-own="quick-entry"
          className={styles.entry}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className={styles.head} data-phone={phone ? "" : undefined}>
            <DialogTitle
              render={(props) => <h2 {...props} className={styles.title} />}
            >
              {t("entry.title")}
            </DialogTitle>
            {phone && (
              <DialogClose
                render={(props) => (
                  <button {...props} type="button" className={styles.cancel}>
                    {t("entry.cancel")}
                  </button>
                )}
              />
            )}
          </div>
          <div className={styles.line}>
            <input
              ref={field}
              className={styles.field}
              aria-label={t("entry.field")}
              placeholder={t("entry.placeholder")}
              autoComplete="off"
              enterKeyHint="send"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setMissing(false);
              }}
            />
            {!phone && <Kbd size="xs">{t("entry.esc")}</Kbd>}
          </div>
          {phone && (
            <div
              className={styles.examples}
              aria-label={t("entry.examples")}
              role="group"
            >
              {examples.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={styles.example}
                  onClick={() => {
                    setText(t(key));
                    setChosen(null);
                    field.current?.focus();
                  }}
                >
                  {t(key)}
                </button>
              ))}
            </div>
          )}
          <dl className={styles.preview}>
            <dt>{t("entry.amount")}</dt>
            <dd data-empty={parse.amount === null ? "" : undefined}>
              {parse.amount === null
                ? empty
                : money(parse.amount, account?.currency ?? base)}
            </dd>
            <dt>{t("entry.description")}</dt>
            <dd data-empty={parse.description === "" ? "" : undefined}>
              {parse.description === "" ? empty : parse.description}
            </dd>
            <dt>{t("entry.when")}</dt>
            <dd>{when}</dd>
            <dt>{t("entry.account")}</dt>
            <dd data-empty={account === undefined ? "" : undefined}>
              {account?.name ?? empty}
            </dd>
          </dl>
          <ChoiceChips
            label={t("entry.category")}
            choices={categories}
            value={categoryId}
            size={phone ? "lg" : "md"}
            onChange={setChosen}
          />
          <div className={styles.foot}>
            <p className={styles.note} data-note={note} aria-live="polite">
              {note === "missing"
                ? t("entry.missing")
                : note === "impact"
                  ? impact
                  : t("entry.hint")}
            </p>
            <div className={styles.actions}>
              <Button
                type="button"
                tone="secondary"
                variant="ghost"
                size="md"
                onClick={more}
              >
                {t("entry.more")}
              </Button>
              <InkButton
                type="submit"
                size={phone ? "lg" : "md"}
                block={phone}
                disabled={pending}
              >
                {t("entry.post")}
              </InkButton>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
