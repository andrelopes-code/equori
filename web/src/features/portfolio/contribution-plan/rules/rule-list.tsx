import { Button } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import { contributionPlanQuery } from "@/features/portfolio/api";
import type { Rule } from "@/features/portfolio/contribution-plan/model/plan-draft";
import type { EditClass } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { maxRules } from "@/features/portfolio/contribution-plan/model/rule-edits";
import { RuleDialog } from "@/features/portfolio/contribution-plan/rules/rule-dialog";
import { RuleRow } from "@/features/portfolio/contribution-plan/rules/rule-row";
import styles from "@/features/portfolio/contribution-plan/rules/rules.module.css";
import { useT } from "@/i18n/i18n-provider";

interface RuleListProps {
  index: number;
  edit: EditClass;
  editor: PlanEditor;
}

// The rules of a group: the intro line, one row per rule and the button that adds one.
export function RuleList({ index, edit, editor }: RuleListProps) {
  const t = useT();
  const api = useApi();
  const plan = useQuery(contributionPlanQuery(api));

  // The rule under edit: its position, "new" for an added one, undefined with the dialog closed.
  const [editing, setEditing] = useState<number | "new" | undefined>(undefined);

  const guaranteeName = plan.data?.guarantee_name;
  const initial = typeof editing === "number" ? edit.rules[editing] : undefined;

  function handleSave(rule: Rule) {
    if (editing === "new") editor.addRule(index, rule);
    else if (editing !== undefined) editor.replaceRule(index, editing, rule);
    setEditing(undefined);
  }

  return (
    <>
      <Text size="sm" tone="muted" className={styles.intro}>
        {t("contributionPlan.rule.intro")}
      </Text>

      <div role="list" className={styles.rules}>
        {edit.rules.map((rule, at) => (
          <RuleRow
            key={`rule-${String(index)}-${String(at)}`}
            index={index}
            rule={rule}
            draft={editor.draft}
            guaranteeName={guaranteeName}
            onEdit={() => {
              setEditing(at);
            }}
            onRemove={() => {
              editor.removeRule(index, at);
            }}
          />
        ))}
      </div>

      <div className={styles.add}>
        <Button
          size="sm"
          variant="outline"
          tone="secondary"
          start={<Glyph name="plus" />}
          disabled={edit.rules.length >= maxRules}
          onClick={() => {
            setEditing("new");
          }}
        >
          {t("contributionPlan.rule.add")}
        </Button>
      </div>

      {editing !== undefined && (
        <RuleDialog
          name={edit.name}
          draft={editor.draft}
          index={index}
          initial={initial}
          guaranteeName={guaranteeName}
          onSave={handleSave}
          onClose={() => {
            setEditing(undefined);
          }}
        />
      )}
    </>
  );
}
