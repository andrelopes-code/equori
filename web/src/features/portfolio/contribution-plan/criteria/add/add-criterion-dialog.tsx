import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Inline } from "@slotted/react/inline";
import { List } from "@slotted/react/list";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { CriterionOption } from "@/features/portfolio/contribution-plan/criteria/add/criterion-option";
import { MethodHelp } from "@/features/portfolio/contribution-plan/criteria/add/method-help";
import {
  criterionGroups,
  limitCriteria,
} from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import { criterionText } from "@/features/portfolio/contribution-plan/criteria/model/criterion-text";
import { piotroskiFacts } from "@/features/portfolio/contribution-plan/model/fact-answers";
import { maxQuestions } from "@/features/portfolio/contribution-plan/model/question-edits";
import { useT } from "@/i18n/i18n-provider";

interface AddCriterionDialogProps {
  // The fact of each criterion of the group, "" for an own one.
  facts: string[];
  onOwn: () => void;
  onFacts: (facts: string[]) => void;
  onClose: () => void;
}

// The panel of criteria: the own one first, then the automatic ones by what they read. It stays
// open, so several are added in one pass.
export function AddCriterionDialog({
  facts,
  onOwn,
  onFacts,
  onClose,
}: AddCriterionDialogProps) {
  const t = useT();

  const room = maxQuestions - facts.length;
  const signals = piotroskiFacts.filter((fact) => !facts.includes(fact));

  return (
    <Dialog
      open
      size="md"
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("contributionPlan.criteria.add")}</DialogTitle>
          <DialogDescription>
            {room > 0
              ? t("contributionPlan.criteria.addDescription")
              : t("contributionPlan.criteria.full")}
          </DialogDescription>
          <DialogClose />
        </DialogHeader>

        <DialogBody>
          <Stack gap={6}>
            <List variant="framed">
              <CriterionOption
                label={t("contributionPlan.criteria.writeOwn")}
                meaning={t("contributionPlan.criteria.writeOwnMeaning")}
                added={false}
                disabled={room < 1}
                onAdd={onOwn}
              />
            </List>

            {criterionGroups.map((group) => (
              <Stack key={group} gap={2}>
                <Text size="sm" weight="semibold">
                  {t(`contributionPlan.criteria.group.${group}`)}
                </Text>

                <List
                  variant="framed"
                  aria-label={t(`contributionPlan.criteria.group.${group}`)}
                >
                  {limitCriteria
                    .filter((criterion) => criterion.group === group)
                    .map((criterion) => (
                      <CriterionOption
                        key={criterion.key}
                        label={t(criterion.label)}
                        meaning={t(criterion.meaning)}
                        added={facts.includes(criterion.key)}
                        disabled={room < 1}
                        onAdd={() => {
                          onFacts([criterion.key]);
                        }}
                      />
                    ))}
                </List>
              </Stack>
            ))}

            <Stack gap={2}>
              <Inline align="center" justify="between" wrap="nowrap">
                <Inline gap={2} align="center" wrap="nowrap">
                  <Text size="sm" weight="semibold">
                    {t("contributionPlan.criteria.group.signals")}
                  </Text>

                  <MethodHelp />
                </Inline>

                <Button
                  size="sm"
                  variant="outline"
                  tone="secondary"
                  disabled={signals.length === 0 || room < signals.length}
                  onClick={() => {
                    onFacts([...piotroskiFacts]);
                  }}
                >
                  {t("contributionPlan.criteria.addNine")}
                </Button>
              </Inline>

              <div data-slotted-density="comfortable">
                <List
                  variant="framed"
                  aria-label={t("contributionPlan.criteria.group.signals")}
                >
                  {piotroskiFacts.map((fact) => (
                    <CriterionOption
                      key={fact}
                      label={criterionText(t, fact, fact)}
                      added={facts.includes(fact)}
                      disabled={room < 1}
                      onAdd={() => {
                        onFacts([fact]);
                      }}
                    />
                  ))}
                </List>
              </div>
            </Stack>
          </Stack>
        </DialogBody>

        <DialogFooter>
          <Button onClick={onClose}>
            {t("contributionPlan.criteria.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
