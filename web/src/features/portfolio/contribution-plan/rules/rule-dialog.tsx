import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";

import type { components } from "@/api/schema.gen";
import type { Rule } from "@/features/portfolio/contribution-plan/model/plan-draft";
import type { EditDraft } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { RuleDialogFields } from "@/features/portfolio/contribution-plan/rules/rule-dialog-fields";
import { useRuleDialog } from "@/features/portfolio/contribution-plan/rules/use-rule-dialog";
import { useRuleMatch } from "@/features/portfolio/contribution-plan/rules/use-rule-match";
import type { RuleMatch } from "@/features/portfolio/contribution-plan/rules/use-rule-match";
import { useScale } from "@/features/setup";
import type { TFunction } from "@/i18n/i18n-provider";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FormLayout } from "@/ui/form-layout/form-layout";

type Money = components["schemas"]["Money"];

interface RuleDialogProps {
  name: string;
  draft: EditDraft | undefined;
  index: number;
  // The rule under edit; absent for a new one.
  initial?: Rule | undefined;
  guaranteeName?: string | undefined;
  onSave: (rule: Rule) => void;
  onClose: () => void;
}

// The form of one rule of a group, with the securities that would join the group today.
export function RuleDialog({
  name,
  draft,
  index,
  initial,
  guaranteeName,
  onSave,
  onClose,
}: RuleDialogProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const dialog = useRuleDialog(initial);

  const match = useRuleMatch(
    draft,
    index,
    dialog.canSave ? dialog.rule : undefined,
  );
  const line = enterLine(dialog.complete, dialog.problem, match, t, (money) =>
    fmt.money(money, scale?.(money.currency) ?? 0),
  );

  return (
    <Dialog
      open
      size="md"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (dialog.canSave) onSave(dialog.rule);
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t("contributionPlan.rule.dialog.title", { name })}
            </DialogTitle>
          </DialogHeader>

          <DialogBody>
            <FormLayout fill>
              <RuleDialogFields
                dialog={dialog}
                guaranteeName={guaranteeName}
                line={line}
              />
            </FormLayout>
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" tone="secondary" onClick={onClose}>
              {t("contributionPlan.rule.dialog.cancel")}
            </Button>
            <Button type="submit" disabled={!dialog.canSave}>
              {t("contributionPlan.rule.dialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function enterLine(
  complete: boolean,
  problem: string | undefined,
  match: RuleMatch | undefined,
  t: TFunction,
  money: (value: Money) => string,
): string | undefined {
  if (!complete) return t("contributionPlan.rule.dialog.needCondition");
  if (problem !== undefined || match === undefined) return undefined;
  if (match.count === 0) return t("contributionPlan.rule.dialog.entersNone");

  const value = money(match.value);

  return match.count === 1
    ? t("contributionPlan.rule.dialog.entersOne", { value })
    : t("contributionPlan.rule.dialog.entersMany", {
        count: match.count,
        value,
      });
}
