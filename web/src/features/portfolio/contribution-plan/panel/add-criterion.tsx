import { Button } from "@slotted/react/button";
import { Field, FieldError } from "@slotted/react/field";
import { Text } from "@slotted/react/typography";
import { Textarea } from "@slotted/react/textarea";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { AddCriterionDialog } from "@/features/portfolio/contribution-plan/criteria/add/add-criterion-dialog";
import {
  fearGreedFact,
  limitCriteria,
  maxQuestions,
} from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import { AddCriterionClosed } from "@/features/portfolio/contribution-plan/panel/add-criterion-closed";
import { OfferedCriteria } from "@/features/portfolio/contribution-plan/panel/offered-criteria";
import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";
import { useAddCriterion } from "@/features/portfolio/contribution-plan/panel/use-add-criterion";
import type { Criteria } from "@/features/portfolio/contribution-plan/panel/use-criteria";
import { useT } from "@/i18n/i18n-provider";

type Group = components["schemas"]["ContributionClass"];

interface AddCriterionProps {
  cls: Group;
  // Whether an asset of the group has a company report, which the company criteria read.
  hasCompany: boolean;
  criteria: Criteria;
  // A group without criteria opens the composer.
  initiallyOpen: boolean;
  // The text of the criterion just added whose settings the reader still chooses.
  onAdded: (question: string | undefined) => void;
}

const picked = 3;
const maxLength = 200;

// The way to a new criterion: a question of the investor, or one equori answers. It starts by warning
// only, so it changes no purchase (CO1).
export function AddCriterion({
  cls,
  hasCompany,
  criteria,
  initiallyOpen,
  onAdded,
}: AddCriterionProps) {
  const t = useT();
  const add = useAddCriterion(cls.name, criteria);
  const [open, setOpen] = useState(initiallyOpen);
  const [text, setText] = useState("");
  const [all, setAll] = useState(false);

  const offered = limitCriteria
    .filter((c) =>
      hasCompany ? c.group !== "market" : c.key === fearGreedFact,
    )
    .filter((c) => !cls.question_facts.includes(c.key))
    .slice(0, picked);
  const typed = text.trim();
  const repeated = cls.questions.some(
    (q) => q.trim().toLowerCase() === typed.toLowerCase(),
  );
  const full = cls.questions.length >= maxQuestions;

  function handleOwn() {
    if (typed === "" || repeated || full) return;

    add.addOwn(typed, () => {
      setText("");
      setOpen(false);
      onAdded(undefined);
    });
  }

  function handleFacts(facts: string[]) {
    add.addFacts(facts, () => {
      const [first] = facts;
      const criterion = limitCriteria.find((c) => c.key === first);

      setOpen(false);
      onAdded(
        facts.length === 1 && criterion !== undefined
          ? t(criterion.label)
          : undefined,
      );
    });
  }

  if (!open) {
    return (
      <AddCriterionClosed
        full={full}
        onOpen={() => {
          setOpen(true);
        }}
      />
    );
  }

  return (
    <div className={styles.compose}>
      <Field necessity="none" invalid={repeated}>
        <div className={styles.composeField}>
          <Textarea
            autoSize
            rows={1}
            resize="none"
            maxLength={maxLength}
            placeholder={t("contributionPlan.panel.write")}
            aria-label={t("contributionPlan.panel.newCriterion")}
            value={text}
            onChange={(event) => {
              setText(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return;
              event.preventDefault();
              handleOwn();
            }}
          />

          <Button
            variant="outline"
            tone="secondary"
            disabled={typed === "" || repeated}
            onClick={handleOwn}
          >
            {t("contributionPlan.criteria.addOne")}
          </Button>
        </div>

        {repeated && (
          <FieldError>{t("contributionPlan.panel.repeated")}</FieldError>
        )}
      </Field>

      <Text size="xs" tone="muted">
        {cls.members.length > 1
          ? t("contributionPlan.panel.startsWarningGroup", {
              count: String(cls.members.length),
            })
          : t("contributionPlan.panel.startsWarning")}
      </Text>

      <OfferedCriteria
        offered={offered}
        onAdd={(fact) => {
          handleFacts([fact]);
        }}
      />

      <div className={styles.condMeta}>
        {!hasCompany && (
          <Text size="xs" tone="muted">
            {t("contributionPlan.panel.noCompany")}
          </Text>
        )}

        <span className={styles.grow} />

        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          onClick={() => {
            setAll(true);
          }}
        >
          {t("contributionPlan.panel.seeAll")}
        </Button>
      </div>

      {all && (
        <AddCriterionDialog
          facts={cls.question_facts}
          onOwn={() => {
            setAll(false);
          }}
          onFacts={handleFacts}
          onClose={() => {
            setAll(false);
          }}
        />
      )}
    </div>
  );
}
