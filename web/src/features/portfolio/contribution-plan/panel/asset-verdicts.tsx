import type { components } from "@/api/schema.gen";
import {
  setGroupReleased,
  setReleased,
} from "@/features/portfolio/contribution-plan/panel/criteria-edits";
import type { CriterionView } from "@/features/portfolio/contribution-plan/panel/criterion-view";
import { PanelVerdict } from "@/features/portfolio/contribution-plan/panel/panel-verdict";
import type { Criteria } from "@/features/portfolio/contribution-plan/panel/use-criteria";
import {
  assetVerdict,
  groupVerdict,
} from "@/features/portfolio/contribution-plan/panel/verdict";
import { useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Group = components["schemas"]["ContributionClass"];
type Member = Group["members"][number];
type Money = components["schemas"]["Money"];

interface AssetVerdictsProps {
  cls: Group;
  // The asset shown alone; undefined in the view of the whole group.
  member: Member | undefined;
  // Whether the panel was opened on the group itself.
  group: boolean;
  // The group split by the amount.
  split: Group | undefined;
  criteria: Criteria;
  list: CriterionView[];
  holdsIgnored: boolean;
  readOnly: boolean;
  // What the asset gives up this month.
  forgone: Money | undefined;
}

// What the criteria do this month to the asset, or to a group opened as one row.
export function AssetVerdicts({
  cls,
  member,
  group,
  split,
  criteria,
  list,
  holdsIgnored,
  readOnly,
  forgone,
}: AssetVerdictsProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);

  return (
    <>
      {member !== undefined && (
        <PanelVerdict
          verdict={assetVerdict({
            t,
            locale,
            money,
            cls,
            member,
            criteria: list,
            forgone,
            holdsIgnored,
          })}
          readOnly={readOnly}
          onRelease={(released) => {
            criteria.save(setReleased(cls.name, member, released));
          }}
        />
      )}

      {group && cls.members.length > 0 && (
        <PanelVerdict
          verdict={groupVerdict({
            t,
            money,
            cls,
            forgone: split?.forgone,
            holdsIgnored,
          })}
          readOnly={readOnly}
          onRelease={(released) => {
            criteria.save(setGroupReleased(cls.name, released));
          }}
        />
      )}
    </>
  );
}
