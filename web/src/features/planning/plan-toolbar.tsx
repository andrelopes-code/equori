import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Heading } from "@slotted/react/typography";

import styles from "@/features/planning/budget-plan.module.css";
import { useT } from "@/i18n/i18n-provider";

export type SuggestBasis = "average" | "last_month";

// The heading of the month's budgets and what fills them at once: the unit the amounts are
// typed in, the distribution of the rest and the suggestion from history.
export function PlanToolbar({
  heading,
  previousMonth,
  unit,
  shareable,
  canDistribute,
  suggestPrimary,
  onUnit,
  onDistribute,
  onPickOne,
  onSuggest,
}: {
  heading: string;
  previousMonth: string;
  unit: "money" | "share";
  // A reference above zero, which a percent is read against.
  shareable: boolean;
  canDistribute: boolean;
  // No budget exists yet: the suggestion is the way in.
  suggestPrimary: boolean;
  onUnit: (unit: "money" | "share") => void;
  onDistribute: () => void;
  onPickOne: () => void;
  onSuggest: (basis: SuggestBasis) => void;
}) {
  const t = useT();
  return (
    <div className={styles.toolbar}>
      <Heading level={3} size="md">
        {heading}
      </Heading>
      <Inline gap={2} wrap="wrap">
        <SegmentedControl
          aria-label={t("plan.unit")}
          size="sm"
          value={unit}
          onValueChange={(value) => {
            onUnit(value === "share" ? "share" : "money");
          }}
        >
          <Segment value="money">{t("plan.unit.money")}</Segment>
          <Segment value="share" disabled={!shareable}>
            {t("plan.unit.share")}
          </Segment>
        </SegmentedControl>
        <Menu>
          <MenuTrigger
            render={(props) => (
              <Button
                {...props}
                size="sm"
                variant="outline"
                tone="secondary"
                disabled={!canDistribute}
              >
                {t("plan.distribute")}
              </Button>
            )}
          />
          <MenuContent>
            <MenuItem onSelect={onDistribute}>
              {t("plan.distribute.proportional")}
            </MenuItem>
            <MenuItem onSelect={onPickOne}>{t("plan.distribute.one")}</MenuItem>
          </MenuContent>
        </Menu>
        <Menu>
          <MenuTrigger
            render={(props) => (
              <Button
                {...props}
                size="sm"
                {...(suggestPrimary
                  ? {}
                  : {
                      variant: "outline" as const,
                      tone: "secondary" as const,
                    })}
              >
                {t("plan.suggest")}
              </Button>
            )}
          />
          <MenuContent>
            <MenuItem
              onSelect={() => {
                onSuggest("average");
              }}
            >
              {t("plan.suggest.average")}
            </MenuItem>
            <MenuItem
              onSelect={() => {
                onSuggest("last_month");
              }}
            >
              {t("plan.suggest.lastMonth", { month: previousMonth })}
            </MenuItem>
          </MenuContent>
        </Menu>
      </Inline>
    </div>
  );
}
