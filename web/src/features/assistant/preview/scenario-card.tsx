import { Card, CardActions, CardBody, CardHeader } from "@slotted/react/card";
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { Heading, Text } from "@slotted/react/typography";

import { MessageItem } from "@/features/assistant/message/message-item";
import { UserMessage } from "@/features/assistant/message/user-message";
import styles from "@/features/assistant/preview/answers-preview.module.css";
import {
  scenarioMessage,
  type Scenario,
} from "@/features/assistant/preview/scenario";
import { useT } from "@/i18n/i18n-provider";

interface ScenarioCardProps {
  scenario: Scenario;
}

// One question and the answer the conversation draws for it, at the width of the assistant pane.
export function ScenarioCard({ scenario }: ScenarioCardProps) {
  const t = useT();

  return (
    <Card render={(props) => <article {...props} />}>
      <CardHeader>
        <Heading level={3}>{scenario.form}</Heading>
        <Text size="sm" tone="muted">
          {scenario.note}
        </Text>
        <CardActions>
          <Tag tone={scenario.handled ? "success" : "warning"}>
            {t(
              scenario.handled
                ? "assistantPreview.handled"
                : "assistantPreview.fallback",
            )}
          </Tag>
        </CardActions>
      </CardHeader>

      <CardBody>
        <Stack gap={4} className={styles.thread}>
          <UserMessage text={scenario.question} files={[]} />
          <MessageItem
            message={scenarioMessage(scenario)}
            steps={scenario.steps}
          />
        </Stack>
      </CardBody>
    </Card>
  );
}
