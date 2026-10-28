import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button, ButtonLink } from "@slotted/react/button";
import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { List, ListEmpty, ListSection } from "@slotted/react/list";
import { Page, PageBody, PageFooter } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { toast } from "@slotted/react/toast";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { accountsQuery } from "@/features/accounts";
import { meQuery } from "@/features/session";
import { payeesQuery, settingsQuery, useScale } from "@/features/setup";
import { AccountField } from "@/features/transactions/account-field";
import {
  capturePreviewQuery,
  captureSuggestionsQuery,
  tagsQuery,
  useRecordBatch,
} from "@/features/transactions/api";
import {
  draftOf,
  entryOf,
  issuesOf,
  lineKeys,
  overrideWithChoice,
  problemsOf,
  pruneOverrides,
  suggestionItems,
  suggestionKey,
} from "@/features/transactions/capture-draft";
import type {
  LineDraft,
  LineOverride,
} from "@/features/transactions/capture-draft";
import { CaptureComposer } from "@/features/transactions/capture-composer";
import { CaptureEditDialog } from "@/features/transactions/capture-edit-dialog";
import { CaptureLineItem } from "@/features/transactions/capture-line-item";
import {
  findQueued,
  readQueue,
  removeQueued,
} from "@/features/transactions/capture-queue";
import styles from "@/features/transactions/capture-page.module.css";
import {
  readCaptureDraft,
  readDefaultAccount,
  writeCaptureDraft,
  writeDefaultAccount,
  writeEntryForm,
} from "@/features/transactions/capture-store";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useDebounced } from "@/ui/use-debounced";
import { useMediaQuery, wideQuery } from "@/ui/use-media-query";
import { PageBack } from "@/ui/page-back";

// The pause after the last key before the text is read again.
const readDelay = 250;
const suggestDelay = 1200;
const refusedEntry = /^entries\[(\d+)\]/;

// A115: the owner writes one transaction per line; each line becomes a draft beside the text,
// and Record writes every draft in one batch or none (A114).
export function CapturePage() {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const navigate = useNavigate();
  const wide = useMediaQuery(wideQuery);
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const tags = useQuery(tagsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const scale = useScale();
  const record = useRecordBatch();
  const [locale] = useAppLocale();
  const me = useQuery({ ...meQuery(api), staleTime: Infinity });
  // P5 of ADR 022: a text of the offline queue opens with the day it was written; it neither
  // reads nor writes the session's draft.
  const { queued: queuedId } = useSearch({
    from: "/_authed/transactions/capture",
  });
  const [entry] = useState(() =>
    queuedId === undefined ? undefined : findQueued(queuedId),
  );
  const waiting = me.data === undefined ? 0 : readQueue(me.data.id).length;

  const [stored] = useState(() =>
    entry === undefined
      ? readCaptureDraft()
      : { text: entry.text, overrides: {} },
  );
  const [text, setText] = useState(stored.text);
  const [overrides, setOverrides] = useState(stored.overrides);
  const [defaultAccountId, setDefaultAccountId] = useState(
    () => entry?.defaultAccountId ?? readDefaultAccount(),
  );
  const [editing, setEditing] = useState<number | null>(null);
  const [refusal, setRefusal] = useState<{
    index: number;
    message: string;
  } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    writeEntryForm("text");
  }, []);
  useEffect(() => {
    if (entry === undefined) writeCaptureDraft({ text, overrides });
  }, [entry, text, overrides]);

  const accountsById = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.id, a])),
    [accounts.data],
  );
  const payeeNames = useMemo(
    () => new Map((payees.data ?? []).map((p) => [p.id, p.name])),
    [payees.data],
  );
  // A default account closed since it was chosen is no longer one a line may take.
  const defaultAccount =
    defaultAccountId !== null &&
    accountsById.get(defaultAccountId)?.closed_on === undefined &&
    accountsById.has(defaultAccountId)
      ? defaultAccountId
      : null;

  const settled = useDebounced(text, readDelay);
  const preview = useQuery({
    ...capturePreviewQuery(
      api,
      settled,
      defaultAccount,
      entry?.capturedOn ?? null,
    ),
    enabled: settled.trim() !== "" && accounts.data !== undefined,
  });
  const empty = text.trim() === "";
  const answered = preview.data?.lines;
  const lines = useMemo(
    () => (empty ? [] : (answered ?? [])),
    [empty, answered],
  );
  // The drafts on screen answer the text as it stands only once the reading caught up.
  const current =
    !empty &&
    settled === text &&
    preview.data !== undefined &&
    !preview.isPlaceholderData &&
    !preview.isFetching;
  const keys = useMemo(() => lineKeys(lines), [lines]);

  // Once the reading caught up, the changes of lines no longer in the text are dropped, so
  // writing a line again starts from its reading (A115).
  const [prunedFor, setPrunedFor] = useState<readonly string[] | null>(null);
  if (current && prunedFor !== keys) {
    setPrunedFor(keys);
    setOverrides((o) => pruneOverrides(o, keys));
  }

  const base = settings.data?.base_currency;
  const ready =
    accounts.data !== undefined && base !== undefined && scale !== null;
  const read = lines.map((line, i) => {
    const override = overrides[keys[i] ?? ""];
    const draft = draftOf(line, override);
    const issues = issuesOf(line, override);
    return {
      key: keys[i] ?? String(i),
      line,
      draft,
      issues,
      edited: override?.edited !== undefined,
      problems: issues.length > 0 ? [] : problemsOf(draft, accountsById),
    };
  });

  // ADR 014 L5: a language model is asked once the text has been still for a while, so a
  // pause inside a word costs no request.
  const still = useDebounced(text, suggestDelay) === text;
  const suggestions = useQuery(
    captureSuggestionsQuery(api, current && still ? suggestionItems(read) : []),
  );
  const suggested = new Map(
    (suggestions.data ?? []).map((s) => [
      suggestionKey(s.description, s.kind),
      s.categoryId,
    ]),
  );
  const rows = read.map((r) => {
    const categoryId =
      r.edited || r.draft.categoryId !== null
        ? null
        : (suggested.get(
            suggestionKey(r.draft.description.trim(), r.draft.kind),
          ) ?? null);
    return categoryId === null
      ? { ...r, suggested: false }
      : { ...r, draft: { ...r.draft, categoryId }, suggested: true };
  });
  const attention = rows.filter(
    (r) => r.issues.length > 0 || r.problems.length > 0,
  ).length;

  const setOverride = (index: number, next: LineOverride) => {
    const key = keys[index];
    if (key === undefined) return;
    setRefusal(null);
    setOverrides((o) => ({ ...o, [key]: next }));
  };

  const submit = async () => {
    if (!ready || !current || rows.length === 0 || record.isPending) return;
    if (attention > 0) {
      setSummary(t("capture.fix"));
      return;
    }
    setSummary(null);
    setRefusal(null);
    try {
      const batch = await record.mutateAsync(
        rows.map((r) => entryOf(r.draft, accountsById, base)),
      );
      // The entry leaves the queue only once its transactions are recorded.
      if (entry !== undefined) removeQueued(entry.id);
      setText("");
      setOverrides({});
      toast.show({
        tone: "success",
        title: t("capture.recorded", { count: batch.items.length }),
        actions: (
          <Button
            size="sm"
            variant="ghost"
            tone="secondary"
            onClick={() => {
              void navigate({ to: "/transactions" });
            }}
          >
            {t("entry.view")}
          </Button>
        ),
      });
      if (entry !== undefined) void navigate({ to: "/transactions/queue" });
    } catch (error) {
      if (error instanceof ProblemError) {
        const [field, message] =
          Object.entries(fieldErrors(error.problem))[0] ?? [];
        const index =
          field === undefined ? undefined : refusedEntry.exec(field)?.[1];
        if (index !== undefined && message !== undefined) {
          const line = rows[Number(index)]?.line.line ?? Number(index) + 1;
          setRefusal({ index: Number(index), message });
          setSummary(t("capture.refused", { line, reason: message }));
          return;
        }
      }
      setSummary(errorText(error, t));
    }
  };

  const clear = () => {
    setText("");
    setOverrides({});
    setSummary(null);
    setRefusal(null);
  };

  const editingRow = editing === null ? undefined : rows[editing];

  return (
    <Page
      width="wide"
      footer={
        <PageFooter>
          <ActionBar aria-label={t("entry.actions")}>
            <ActionBarActions>
              <ActionBarAction>
                <Button
                  variant="ghost"
                  tone="secondary"
                  disabled={empty}
                  onClick={clear}
                >
                  {t("capture.clear")}
                </Button>
              </ActionBarAction>
              <ActionBarAction>
                <Button
                  disabled={!ready || !current || rows.length === 0}
                  loading={record.isPending}
                  aria-keyshortcuts="Control+Enter"
                  onClick={() => {
                    void submit();
                  }}
                >
                  {t("capture.record", { count: rows.length })}
                </Button>
              </ActionBarAction>
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
              <PageHeaderHeading>{t("capture.title")}</PageHeaderHeading>
            </PageHeaderTitle>
            <PageHeaderActions>
              <ButtonLink
                variant="outline"
                tone="secondary"
                href="/transactions/new"
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
                  void navigate({ to: "/transactions/new" });
                }}
              >
                {t("capture.useForm")}
              </ButtonLink>
              {entry === undefined && waiting > 0 && (
                <ButtonLink
                  variant="outline"
                  tone="secondary"
                  href="/transactions/queue"
                  // Workaround for Slotted finding "ButtonLink render props cannot be spread onto a
                  // router link": as above.
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
                    void navigate({ to: "/transactions/queue" });
                  }}
                >
                  {t("capture.queue", { count: waiting })}
                </ButtonLink>
              )}
            </PageHeaderActions>
          </PageHeaderTitleRow>
          <PageHeaderDescription>
            {entry === undefined
              ? t("capture.subheading")
              : t("capture.queuedFrom", {
                  date: formatDate(entry.capturedOn, locale),
                })}
          </PageHeaderDescription>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <div className={styles.layout}>
          <div className={styles.writer}>
            <Stack gap={6}>
              {ready && (
                <Field>
                  <FieldLabel>{t("capture.defaultAccount")}</FieldLabel>
                  <AccountField
                    name="default_account_id"
                    title={t("capture.defaultAccount")}
                    accounts={accounts.data}
                    value={defaultAccount}
                    onChange={(id) => {
                      setDefaultAccountId(id);
                      writeDefaultAccount(id);
                    }}
                    exclude={null}
                    amount={0}
                    direction="out"
                    date={entry?.capturedOn ?? today}
                    categoryId={null}
                    payeeId={null}
                    kind="expense"
                    currency={base}
                    scale={scale}
                    compact
                    context={t("capture.defaultAccountHint")}
                  />
                  <FieldDescription>
                    {t("capture.defaultAccountHint")}
                  </FieldDescription>
                </Field>
              )}
              <Stack gap={2}>
                <CaptureComposer
                  value={text}
                  busy={(!empty && !current) || record.isPending}
                  // A phone would open its keyboard over the page before the reader chose to type.
                  autoFocus={wide}
                  onChange={(value) => {
                    setText(value);
                    setSummary(null);
                    setRefusal(null);
                  }}
                  onRecord={() => {
                    void submit();
                  }}
                />
                <Text size="sm" tone="muted">
                  {t("capture.syntax")}
                </Text>
              </Stack>
            </Stack>
          </div>
          <Stack gap={4}>
            {summary !== null && (
              <InlineMessage tone="danger" size="md" live="polite">
                {summary}
              </InlineMessage>
            )}
            {preview.isError && (
              <InlineMessage tone="danger" size="md">
                {errorText(preview.error, t)}
              </InlineMessage>
            )}
            <List
              variant="separated"
              aria-label={t("capture.drafts")}
              loading={!empty && !current}
            >
              <ListSection
                label={t("capture.drafts")}
                end={
                  rows.length === 0
                    ? undefined
                    : attention === 0
                      ? t("capture.summary", { count: rows.length })
                      : `${t("capture.summary", { count: rows.length })} · ${t("capture.attention", { count: attention })}`
                }
              >
                {rows.length === 0 ? (
                  <ListEmpty>{t("capture.empty")}</ListEmpty>
                ) : (
                  ready &&
                  rows.map((r, i) => (
                    <CaptureLineItem
                      key={r.key}
                      line={r.line}
                      draft={r.draft}
                      issues={r.issues}
                      problems={r.problems}
                      edited={r.edited}
                      suggested={r.suggested}
                      refusal={refusal?.index === i ? refusal.message : null}
                      accounts={accountsById}
                      payees={payeeNames}
                      baseCurrency={base}
                      scale={scale}
                      onChoose={(issue, choice) => {
                        setOverride(
                          i,
                          overrideWithChoice(overrides[r.key], issue, choice),
                        );
                      }}
                      onEdit={() => {
                        setEditing(i);
                      }}
                    />
                  ))
                )}
              </ListSection>
            </List>
          </Stack>
        </div>
        {editingRow !== undefined && editing !== null && ready && (
          <CaptureEditDialog
            lineNumber={editingRow.line.line}
            initial={editingRow.draft}
            accounts={accounts.data}
            accountsById={accountsById}
            payees={payees.data ?? []}
            tags={tags.data ?? []}
            baseCurrency={base}
            scale={scale}
            onApply={(draft: LineDraft) => {
              setOverride(editing, {
                ...overrides[editingRow.key],
                edited: draft,
              });
              setEditing(null);
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
