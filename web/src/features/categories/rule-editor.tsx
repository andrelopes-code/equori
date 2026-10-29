import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Glyph, Icon } from "@slotted/react/icon";
import { InlineMessage } from "@slotted/react/inline-message";
import { Page, PageBody, PageFooter } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { toast } from "@slotted/react/toast";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { ActionRow } from "@/features/categories/action-row";
import {
  useCreateRule,
  useDeleteRule,
  useReplaceRule,
} from "@/features/categories/api";
import type { Choice } from "@/ui/choice-select";
import { ConditionRow } from "@/features/categories/condition-row";
import {
  draftFromRule,
  draftProblems,
  emptyAction,
  limits,
  prefilledDraft,
} from "@/features/categories/rule-draft";
import type { RuleDraft } from "@/features/categories/rule-draft";
import styles from "@/features/categories/rule-editor-page.module.css";
import { RulePreview } from "@/features/categories/rule-preview";
import { RuleReading } from "@/features/categories/rule-reading";
import { useRuleWords } from "@/features/categories/use-rule-words";
import { payeesQuery, settingsQuery, useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMediaQuery, wideQuery } from "@/ui/use-media-query";
import { PageBack } from "@/ui/page-back";
import { FormLayout } from "@/ui/form-layout";
import { FormSection } from "@/ui/form-section";

type Rule = components["schemas"]["Rule"];

export function RuleEditor({ rule }: { rule: Rule | null }) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const navigate = useNavigate();
  const wide = useMediaQuery(wideQuery);
  const prefill = useSearch({ strict: false });
  const words = useRuleWords();
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const settings = useQuery(settingsQuery(api));
  const scale = useScale();
  const create = useCreateRule();
  const replace = useReplaceRule();
  const remove = useDeleteRule();

  const [draft, setDraft] = useState<RuleDraft>(() =>
    rule === null
      ? prefilledDraft({
          payee: prefill.payee,
          description: prefill.description,
          category: prefill.category,
          name: prefill.name,
        })
      : draftFromRule(rule),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const currency = settings.data?.base_currency;
  const digits = currency === undefined ? 2 : (scale?.(currency) ?? 2);
  const payeeChoices = useMemo<Choice[]>(() => {
    const collator = new Intl.Collator(locale, { sensitivity: "base" });
    return (payees.data ?? [])
      .map((p) => ({ value: p.id, label: p.name }))
      .sort((a, b) => collator.compare(a.label, b.label));
  }, [payees.data, locale]);
  const balance = (accounts.data ?? []).filter(
    (a) =>
      (a.class === "asset" || a.class === "liability") &&
      a.closed_on === undefined,
  );
  const accountChoices: Choice[] = balance.map((a) => ({
    value: a.id,
    label: a.name,
  }));
  const receivables: Choice[] = balance
    .filter((a) => a.kind === "receivable")
    .map((a) => ({ value: a.id, label: a.name }));

  // BD-03: once a save is tried, each node the server would refuse is marked as the reader types.
  const problems = draftProblems(draft);
  const shown: Record<string, string> = {
    ...(tried
      ? Object.fromEntries(
          Object.entries(problems).map(([k, key]) => [k, t(key)]),
        )
      : {}),
    ...errors,
  };
  const ready = Object.keys(problems).length === 0;

  const update = (next: RuleDraft) => {
    setDraft(next);
    setErrors({});
  };

  const save = async () => {
    setTried(true);
    setSummary(null);
    if (!ready) {
      setSummary(t("entry.fixFields"));
      return;
    }
    const body = { ...draft, name: draft.name.trim() };
    try {
      if (rule === null) await create.mutateAsync(body);
      else await replace.mutateAsync({ id: rule.id, body });
      toast.show({ tone: "success", title: t("ruleEditor.saved") });
      void navigate({ to: "/categories/rules" });
    } catch (error) {
      if (error instanceof ProblemError) setErrors(fieldErrors(error.problem));
      setSummary(errorText(error, t));
    }
  };

  const setCondition = (
    index: number,
    next: RuleDraft["conditions"][number],
  ) => {
    update({
      ...draft,
      conditions: draft.conditions.map((c, i) => (i === index ? next : c)),
    });
  };
  const setAction = (index: number, next: RuleDraft["actions"][number]) => {
    update({
      ...draft,
      actions: draft.actions.map((a, i) => (i === index ? next : a)),
    });
  };

  return (
    <Page
      width="wide"
      footer={
        <PageFooter>
          <ActionBar aria-label={t("ruleEditor.save")}>
            <ActionBarActions>
              <ActionBarAction>
                <Button
                  variant="ghost"
                  tone="secondary"
                  onClick={() => {
                    void navigate({ to: "/categories/rules" });
                  }}
                >
                  {t("detail.cancel")}
                </Button>
              </ActionBarAction>
              <ActionBarAction>
                <Button
                  loading={create.isPending || replace.isPending}
                  onClick={() => {
                    void save();
                  }}
                >
                  {t("ruleEditor.save")}
                </Button>
              </ActionBarAction>
            </ActionBarActions>
          </ActionBar>
        </PageFooter>
      }
    >
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          {wide && (
            <PageBack
              render={(props) => <Link {...props} to="/categories/rules" />}
            >
              {t("categories.tab.rules")}
            </PageBack>
          )}
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>
                {rule === null ? t("ruleEditor.newTitle") : rule.name}
              </PageHeaderHeading>
            </PageHeaderTitle>
            {rule !== null && (
              <PageHeaderActions>
                <Button
                  variant="ghost"
                  tone="danger"
                  loading={remove.isPending}
                  onClick={() => {
                    remove
                      .mutateAsync(rule.id)
                      .then(() => {
                        toast.show({
                          tone: "success",
                          title: t("ruleEditor.deleted"),
                        });
                        void navigate({ to: "/categories/rules" });
                      })
                      .catch((error: unknown) => {
                        setSummary(errorText(error, t));
                      });
                  }}
                >
                  {t("ruleEditor.delete")}
                </Button>
              </PageHeaderActions>
            )}
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        {currency === undefined ? (
          <Stack gap={4} aria-busy="true">
            <Skeleton shape="block" blockSize="6rem" />
            <Skeleton shape="block" blockSize="16rem" />
          </Stack>
        ) : (
          <FormLayout
            aside={
              <Stack gap={6}>
                <RuleReading draft={draft} words={words} />
                <Text size="xs" tone="muted">
                  {t("ruleEditor.limits", {
                    conditions: draft.conditions.length,
                    actions: draft.actions.length,
                  })}
                </Text>
                <RulePreview
                  rule={ready ? { ...draft, name: draft.name.trim() } : null}
                />
              </Stack>
            }
          >
            {summary !== null && (
              <InlineMessage tone="danger">{summary}</InlineMessage>
            )}
            <Field invalid={shown.name !== undefined} required>
              <FieldLabel>{t("ruleEditor.name")}</FieldLabel>
              <TextField
                value={draft.name}
                maxLength={120}
                onChange={(event) => {
                  update({ ...draft, name: event.target.value });
                }}
              />
              {shown.name !== undefined && (
                <FieldError>{shown.name}</FieldError>
              )}
            </Field>
            <FormSection
              legend={t("ruleEditor.when")}
              description={t("ruleEditor.whenNote")}
            >
              <Stack gap={3} className={styles.builder}>
                {draft.conditions.map((condition, index) => (
                  <Fragment key={index}>
                    {index > 0 && (
                      <span className={styles.connector}>
                        <Text size="xs" weight="semibold" tone="muted">
                          {t("ruleEditor.and")}
                        </Text>
                      </span>
                    )}
                    <ConditionRow
                      index={index}
                      condition={condition}
                      onChange={(next) => {
                        setCondition(index, next);
                      }}
                      onRemove={() => {
                        update({
                          ...draft,
                          conditions: draft.conditions.filter(
                            (_, i) => i !== index,
                          ),
                        });
                      }}
                      canRemove={draft.conditions.length > 1}
                      error={shown[`conditions[${String(index)}].value`]}
                      payees={payeeChoices}
                      accounts={accountChoices}
                      currency={currency}
                      scale={digits}
                    />
                  </Fragment>
                ))}
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
                    tone="secondary"
                    disabled={draft.conditions.length >= limits.conditions}
                    start={
                      <Icon size="sm">
                        <Glyph name="plus" />
                      </Icon>
                    }
                    onClick={() => {
                      update({
                        ...draft,
                        conditions: [
                          ...draft.conditions,
                          {
                            field: "description",
                            operator: "contains",
                            value: "",
                          },
                        ],
                      });
                    }}
                  >
                    {t("ruleEditor.addCondition")}
                  </Button>
                </div>
              </Stack>
            </FormSection>
            <FormSection
              legend={t("ruleEditor.then")}
              description={t("ruleEditor.thenNote")}
            >
              <Stack gap={3} className={styles.builder}>
                {shown.actions !== undefined && (
                  <InlineMessage tone="danger">{shown.actions}</InlineMessage>
                )}
                {draft.actions.map((action, index) => (
                  <ActionRow
                    key={index}
                    index={index}
                    action={action}
                    onChange={(next) => {
                      setAction(index, next);
                    }}
                    onRemove={() => {
                      update({
                        ...draft,
                        actions: draft.actions.filter((_, i) => i !== index),
                      });
                    }}
                    canRemove={draft.actions.length > 1}
                    errors={shown}
                    payees={payeeChoices}
                    accounts={accountChoices}
                    receivables={receivables}
                    currency={currency}
                    scale={digits}
                  />
                ))}
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
                    tone="secondary"
                    disabled={draft.actions.length >= limits.actions}
                    start={
                      <Icon size="sm">
                        <Glyph name="plus" />
                      </Icon>
                    }
                    onClick={() => {
                      update({
                        ...draft,
                        actions: [...draft.actions, emptyAction("add_tags")],
                      });
                    }}
                  >
                    {t("ruleEditor.addAction")}
                  </Button>
                </div>
              </Stack>
            </FormSection>
            <Checkbox
              checked={draft.enabled}
              onCheckedChange={(checked) => {
                update({ ...draft, enabled: checked });
              }}
            >
              {t("ruleEditor.enabled")}
            </Checkbox>
            <Checkbox
              checked={draft.stop_processing}
              onCheckedChange={(checked) => {
                update({ ...draft, stop_processing: checked });
              }}
            >
              {t("ruleEditor.stop")}
            </Checkbox>
          </FormLayout>
        )}
      </PageBody>
    </Page>
  );
}
