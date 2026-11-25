import { Text } from "@slotted/react/typography";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import type { components } from "@/api/schema.gen";
import type { ListRow } from "@/features/portfolio/contribution-plan/list/list-rows";
import { useCompanyFigures } from "@/features/portfolio/contribution-plan/month/use-company-figures";
import { AssetCriteria } from "@/features/portfolio/contribution-plan/panel/asset-criteria";
import { AssetVerdicts } from "@/features/portfolio/contribution-plan/panel/asset-verdicts";
import { AssetFacts } from "@/features/portfolio/contribution-plan/panel/asset-facts";
import { criteriaOf } from "@/features/portfolio/contribution-plan/panel/criterion-view";
import { PanelHead } from "@/features/portfolio/contribution-plan/panel/panel-head";
import { SaveNotice } from "@/features/portfolio/contribution-plan/panel/save-notice";
import { useCriteria } from "@/features/portfolio/contribution-plan/panel/use-criteria";
import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";
import { useT } from "@/i18n/i18n-provider";

type Plan = components["schemas"]["ContributionPlan"];

interface AssetPanelProps {
  row: ListRow;
  // The plan stored: the criteria and what they hold.
  plan: Plan;
  // The plan split by the amount: what the asset gives up.
  view: Plan;
  readOnly: boolean;
  // Whether the reader opened the panel: the focus then goes to its title.
  asked: boolean;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  onClose: () => void;
  // Enters edit mode with the assets of a group open.
  onSplit: (group: number) => void;
}

const openLayer = "dialog[open], [role=dialog], [role=listbox]";

// The asset chosen in the list: what its criteria do this month, its answers and its facts (spec, Panel).
export function AssetPanel({
  row,
  plan,
  view,
  readOnly,
  asked,
  memberName,
  onClose,
  onSplit,
}: AssetPanelProps) {
  const t = useT();
  const criteria = useCriteria();
  const cls = plan.classes[row.group];
  const companies = useCompanyFigures(
    (cls?.members ?? []).flatMap((m) =>
      m.instrument === undefined ? [] : [m.instrument],
    ),
  );
  const [whole, setWhole] = useState(row.member === undefined);
  const title = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (asked) title.current?.focus();
  }, [asked]);

  if (cls === undefined) return null;

  const member = row.member === undefined ? undefined : cls.members[row.member];
  const split = view.classes[row.group];
  const list = criteriaOf(t, cls);
  const name = whole && cls.members.length > 1 ? cls.name : row.name;
  const byRule = cls.rules.length > 0;
  const hasCompany = companies.size > 0;
  const company =
    member?.instrument === undefined
      ? undefined
      : companies.get(member.instrument);
  const scopes = member !== undefined && cls.members.length > 1;
  const undivided = member === undefined && cls.members.length > 1 && !readOnly;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    // A popup or a dialog over the panel closes by itself. Workaround for Slotted issue #208: the
    // Escape that closes a dialog is marked handled only where the browser has CloseWatcher.
    if (!event.currentTarget.contains(event.target as Node)) return;
    if (document.querySelector(openLayer) !== null) return;

    onClose();
  }

  return (
    <section
      className={styles.panel}
      aria-label={t("contributionPlan.panel.label", { name })}
      aria-busy={criteria.pending}
      onKeyDown={handleKeyDown}
    >
      <PanelHead
        group={row.group}
        name={name}
        groupName={name === cls.name ? "" : cls.name}
        scope={
          scopes
            ? {
                whole,
                asset: row.name,
                count: cls.members.length,
                onWhole: setWhole,
              }
            : undefined
        }
        titleRef={title}
        onClose={onClose}
      />

      <SaveNotice criteria={criteria} />

      <AssetVerdicts
        cls={cls}
        member={whole ? undefined : member}
        group={member === undefined}
        split={split}
        criteria={criteria}
        list={list}
        holdsIgnored={view.holds_ignored}
        readOnly={readOnly}
        forgone={split?.members[row.member ?? 0]?.forgone}
      />

      {byRule && (
        <Text size="sm" tone="muted">
          {t("contributionPlan.panel.byRule")}
        </Text>
      )}

      {!byRule && cls.members.length === 0 && (
        <Text size="sm" tone="muted">
          {t("contributionPlan.panel.noAssets")}
        </Text>
      )}

      {cls.members.length > 0 && (
        <AssetCriteria
          key={String(whole)}
          cls={cls}
          member={whole ? undefined : member}
          list={list}
          hasCompany={hasCompany}
          criteria={criteria}
          readOnly={readOnly}
          memberName={memberName}
        />
      )}

      {!(scopes && whole) && (
        <AssetFacts
          member={member ?? {}}
          entry={row.entry}
          company={company}
          currency={view.total.currency}
          onSplit={
            undivided
              ? () => {
                  onSplit(row.group);
                }
              : undefined
          }
        />
      )}
    </section>
  );
}
