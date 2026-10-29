import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import { Tag } from "@slotted/react/tag";
import type { LinkOptions } from "@tanstack/react-router";

import type { FirstStep, FirstStepId } from "@/features/overview/first-steps";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/route-to";

const destinations: Record<FirstStepId, LinkOptions> = {
  account: { to: "/accounts/new" },
  transactions: { to: "/transactions/new" },
  categories: { to: "/transactions", search: { uncategorized: true } },
};

interface FirstStepItemProps {
  step: FirstStep;
}

export function FirstStepItem({ step }: FirstStepItemProps) {
  const t = useT();

  const body = (
    <ListItemBody>
      <ListItemLabel>{t(`firstSteps.${step.id}`)}</ListItemLabel>
      <ListItemDescription>
        {t(`firstSteps.${step.id}Hint`)}
      </ListItemDescription>
    </ListItemBody>
  );

  if (step.done) {
    return (
      <ListItem>
        {body}
        <ListItemEnd>
          <Tag size="sm" tone="success">
            {t("firstSteps.done")}
          </Tag>
        </ListItemEnd>
      </ListItem>
    );
  }

  return (
    <ListItem>
      <ListItemLink render={routeTo(destinations[step.id])}>
        {body}
      </ListItemLink>
    </ListItem>
  );
}
