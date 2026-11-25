import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { AddCriterion } from "@/features/portfolio/contribution-plan/panel/add-criterion";
import { CriterionEditor } from "@/features/portfolio/contribution-plan/panel/criterion-editor";
import { CriterionItem } from "@/features/portfolio/contribution-plan/panel/criterion-item";
import type { CriterionView } from "@/features/portfolio/contribution-plan/panel/criterion-view";
import { GroupCriterion } from "@/features/portfolio/contribution-plan/panel/group-criterion";
import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";
import type { Criteria } from "@/features/portfolio/contribution-plan/panel/use-criteria";

type Group = components["schemas"]["ContributionClass"];
type Member = Group["members"][number];

interface AssetCriteriaProps {
  cls: Group;
  // The asset; undefined in the view of the whole group.
  member: Member | undefined;
  list: CriterionView[];
  hasCompany: boolean;
  criteria: Criteria;
  readOnly: boolean;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
}

// The criteria of an asset or of its group, one of them edited or open at a time.
export function AssetCriteria({
  cls,
  member,
  list,
  hasCompany,
  criteria,
  readOnly,
  memberName,
}: AssetCriteriaProps) {
  const [editing, setEditing] = useState<string>();
  const [opened, setOpened] = useState<string>();

  function handleDone() {
    setEditing(undefined);
  }

  return (
    <>
      {list.length > 0 && (
        <ul className={styles.conds}>
          {list.map((criterion) => {
            const { question } = criterion;

            if (editing === question && !readOnly) {
              return (
                <CriterionEditor
                  key={criterion.position}
                  cls={cls}
                  member={member}
                  criterion={criterion}
                  criteria={criteria}
                  onRenamed={setEditing}
                  onDone={handleDone}
                />
              );
            }

            return member === undefined ? (
              <GroupCriterion
                key={criterion.position}
                cls={cls}
                criterion={criterion}
                open={opened === question}
                criteria={criteria}
                readOnly={readOnly}
                memberName={memberName}
                onToggle={() => {
                  setOpened(opened === question ? undefined : question);
                }}
                onEdit={() => {
                  setEditing(question);
                }}
              />
            ) : (
              <CriterionItem
                key={criterion.position}
                cls={cls}
                member={member}
                criterion={criterion}
                criteria={criteria}
                readOnly={readOnly}
                onEdit={() => {
                  setEditing(question);
                }}
              />
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <AddCriterion
          key={String(list.length === 0)}
          cls={cls}
          hasCompany={hasCompany}
          criteria={criteria}
          initiallyOpen={list.length === 0}
          onAdded={setEditing}
        />
      )}
    </>
  );
}
