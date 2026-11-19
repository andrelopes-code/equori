import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Text } from "@slotted/react/typography";

import type {
  CalculatorGroup as Group,
  CalculatorId,
} from "@/features/calculators/model/calculators";
import styles from "@/features/calculators/pages/calculators-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

interface CalculatorGroupProps {
  group: Group;
  ids: readonly CalculatorId[];
  // The line under the list, when a calculator of the group is hidden.
  note?: string | undefined;
}

export function CalculatorGroup({ group, ids, note }: CalculatorGroupProps) {
  const t = useT();

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t(`calc.group.${group}`)}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <List variant="framed">
          {ids.map((id) => (
            <ListItem key={id}>
              <ListItemLink
                render={routeTo({ to: "/calculators/$id", params: { id } })}
              >
                <ListItemBody>
                  <ListItemLabel>{t(`calc.${id}.question`)}</ListItemLabel>
                  <ListItemDescription>
                    {t(`calc.${id}.title`)}
                  </ListItemDescription>
                </ListItemBody>
              </ListItemLink>
            </ListItem>
          ))}
        </List>

        {note !== undefined && (
          <Text size="xs" tone="muted" className={styles.missing}>
            {note}
          </Text>
        )}
      </SectionBody>
    </Section>
  );
}
