import { Button } from "@slotted/react/button";
import {
  AlertDialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Inline } from "@slotted/react/inline";
import { Page, PageBody } from "@slotted/react/page";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionTitle,
} from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";
import { toast } from "@slotted/react/toast";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import {
  pendingSuggestionsQuery,
  rulesQuery,
  sourceCategoriesQuery,
  statisticsQuery,
  useAcceptSuggestion,
  useDeleteRule,
  useDismissSuggestion,
  useMapSourceCategory,
  useReorderRules,
  useReplaceRule,
  useRunRules,
} from "@/features/categories/api";
import { CategoriesHeader } from "@/features/categories/categories-header";
import { Coverage } from "@/features/categories/coverage";
import { HeaderAction } from "@/features/categories/header-action";
import { RuleList } from "@/features/categories/rule-list";
import type { RuleAction } from "@/features/categories/rule-list";
import styles from "@/features/categories/rules-page.module.css";
import { SourceCategories } from "@/features/categories/source-categories";
import { SuggestionCard } from "@/features/categories/suggestion-card";
import { useRuleWords } from "@/features/categories/use-rule-words";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Rule = components["schemas"]["Rule"];

function inputOf(rule: Rule): components["schemas"]["RuleInput"] {
  return {
    name: rule.name,
    enabled: rule.enabled,
    stop_processing: rule.stop_processing,
    conditions: rule.conditions,
    actions: rule.actions,
  };
}

export function RulesPage() {
  const t = useT();
  const api = useApi();
  const navigate = useNavigate();
  const today = useToday();
  const from = `${today.slice(0, 7)}-01`;
  const words = useRuleWords();
  const rules = useQuery(rulesQuery(api));
  const suggestions = useQuery(pendingSuggestionsQuery(api));
  const statistics = useQuery(statisticsQuery(api, from, today));
  const sources = useQuery(sourceCategoriesQuery(api));
  const replace = useReplaceRule();
  const reorder = useReorderRules();
  const remove = useDeleteRule();
  const run = useRunRules();
  const accept = useAcceptSuggestion();
  const dismiss = useDismissSuggestion();
  const map = useMapSourceCategory();
  const [order, setOrder] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState<Rule | null>(null);

  const fail = (error: unknown) => {
    toast.show({ tone: "danger", title: errorText(error, t) });
  };

  // The order on screen moves at once; the server's answer replaces it.
  const all = rules.data ?? [];
  const byId = new Map(all.map((r) => [r.id, r]));
  const shown =
    order === null
      ? all
      : order.flatMap((id) => {
          const rule = byId.get(id);
          return rule === undefined ? [] : [rule];
        });
  const move = (ids: string[]) => {
    setOrder(ids);
    reorder
      .mutateAsync(ids)
      .catch(fail)
      .finally(() => {
        setOrder(null);
      });
  };

  const onAction = (rule: Rule, action: RuleAction) => {
    const ids = shown.map((r) => r.id);
    const index = ids.indexOf(rule.id);
    const without = ids.filter((id) => id !== rule.id);
    switch (action) {
      case "edit":
        void navigate({ to: "/categories/rules/$id", params: { id: rule.id } });
        return;
      case "top":
        move([rule.id, ...without]);
        return;
      case "up":
        if (index > 0) without.splice(index - 1, 0, rule.id);
        else return;
        move(without);
        return;
      case "down":
        if (index < ids.length - 1) without.splice(index + 1, 0, rule.id);
        else return;
        move(without);
        return;
      case "delete":
        setDeleting(rule);
        return;
    }
  };

  const pending = suggestions.data ?? [];
  const mapped = sources.data ?? [];

  return (
    <Page width="wide">
      <CategoriesHeader
        current="rules"
        rulesLabel={
          pending.length === 0
            ? undefined
            : t("categories.tab.rulesCount", { count: pending.length })
        }
        actions={
          <Inline gap={2} wrap="nowrap">
            <HeaderAction
              label={t("rules.run")}
              glyph="play"
              loading={run.isPending}
              onClick={() => {
                run
                  .mutateAsync()
                  .then((result) => {
                    toast.show({
                      tone: "success",
                      title: t("rules.ran", {
                        examined: result.examined,
                        categorized: result.categorized,
                      }),
                    });
                  })
                  .catch(fail);
              }}
            />
            <HeaderAction
              primary
              label={t("rules.new")}
              glyph="plus"
              onClick={() => {
                void navigate({ to: "/categories/rules/new" });
              }}
            />
          </Inline>
        }
      />
      <PageBody>
        <Stack gap={8}>
          <Coverage
            statistics={statistics.data}
            loading={statistics.isPending}
            month={today.slice(0, 7)}
          />
          {pending.length > 0 && (
            <Section>
              <SectionHeader>
                <SectionTitle>{t("suggestion.section")}</SectionTitle>
              </SectionHeader>
              <SectionBody>
                <div className={styles.cards}>
                  {pending.map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      words={words}
                      busy={
                        accept.isPending &&
                        accept.variables.id === suggestion.id
                      }
                      dismissing={
                        dismiss.isPending && dismiss.variables === suggestion.id
                      }
                      onAccept={(name) => {
                        accept
                          .mutateAsync({ id: suggestion.id, name })
                          .then(() => {
                            toast.show({
                              tone: "success",
                              title: t("suggestion.accepted", { name }),
                            });
                          })
                          .catch(fail);
                      }}
                      onDismiss={() => {
                        dismiss.mutateAsync(suggestion.id).catch(fail);
                      }}
                    />
                  ))}
                </div>
              </SectionBody>
            </Section>
          )}
          <Section>
            <SectionHeader>
              <SectionTitle>{t("rules.section")}</SectionTitle>
            </SectionHeader>
            <SectionBody>
              <RuleList
                rules={shown}
                words={words}
                loading={rules.isPending}
                onToggle={(rule, enabled) => {
                  replace
                    .mutateAsync({
                      id: rule.id,
                      body: { ...inputOf(rule), enabled },
                    })
                    .catch(fail);
                }}
                onReorder={move}
                onAction={onAction}
              />
            </SectionBody>
          </Section>
          {mapped.length > 0 && (
            <Section>
              <SectionHeader>
                <SectionTitle>{t("sources.section")}</SectionTitle>
              </SectionHeader>
              <SectionBody>
                <SourceCategories
                  items={mapped}
                  onMap={(id, categoryId) => {
                    map.mutateAsync({ id, categoryId }).catch(fail);
                  }}
                />
              </SectionBody>
            </Section>
          )}
        </Stack>
      </PageBody>
      {deleting !== null && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("rules.deleteTitle", { name: deleting.name })}
              </DialogTitle>
              <DialogDescription>
                {t("rules.deleteDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                tone="secondary"
                onClick={() => {
                  setDeleting(null);
                }}
              >
                {t("detail.cancel")}
              </Button>
              <Button
                tone="danger"
                loading={remove.isPending}
                onClick={() => {
                  remove
                    .mutateAsync(deleting.id)
                    .catch(fail)
                    .finally(() => {
                      setDeleting(null);
                    });
                }}
              >
                {t("rules.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </AlertDialog>
      )}
    </Page>
  );
}
