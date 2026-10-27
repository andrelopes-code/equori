import { Card, CardBody } from "@slotted/react/card";
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

// The figure that answers the calculator's question, at the size of a page's largest figure,
// with a sentence that reads it in the reader's terms.
export function ResultLead({
  label,
  value,
  summary,
}: {
  label: string;
  value: string;
  summary?: string;
}) {
  return (
    <Card fill="subtle">
      <CardBody>
        <Stack gap={3}>
          <DescriptionList layout="stack">
            <DescriptionListItem>
              <DescriptionListTerm>{label}</DescriptionListTerm>
              <DescriptionListDescription>
                <Text size="3xl" weight="semibold" numeric="tabular">
                  {value}
                </Text>
              </DescriptionListDescription>
            </DescriptionListItem>
          </DescriptionList>
          {summary !== undefined && (
            <Text size="sm" tone="muted" wrap="pretty">
              {summary}
            </Text>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
}
