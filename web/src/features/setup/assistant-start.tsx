import { Button } from "@slotted/react/button";
import { Card, CardBody } from "@slotted/react/card";
import { Link } from "@slotted/react/link";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useId } from "react";

import { useT } from "@/i18n/i18n-provider";

export type StartPreset = "gemini" | "ollama";

// Families read: card, button, link, typography. Three ways to start the assistant without a
// provider (S1): Google's free tier, a model on this computer or network, or an agent the reader
// already pays for, through MCP.
export function AssistantStart({
  onPreset,
  onExternal,
}: {
  onPreset: (preset: StartPreset) => void;
  onExternal: () => void;
}) {
  const t = useT();
  const id = useId();
  return (
    <Stack gap={3}>
      <Text size="md" weight="semibold">
        {t("assistant.start.title")}
      </Text>
      <Card size="sm">
        <CardBody>
          <Stack gap={2} align="start">
            <Button
              variant="outline"
              aria-describedby={`${id}-gemini`}
              onClick={() => {
                onPreset("gemini");
              }}
            >
              {t("assistant.start.gemini")}
            </Button>
            <Text size="sm" tone="muted" id={`${id}-gemini`}>
              {[
                t("assistant.start.gemini.detail"),
                t("assistant.notice.trains.detail"),
              ].join(" ")}
            </Text>
            <Text size="sm">
              <Link
                href={t("assistant.start.gemini.key_url")}
                target="_blank"
                rel="noreferrer"
              >
                {t("assistant.start.gemini.key")}
              </Link>
            </Text>
          </Stack>
        </CardBody>
      </Card>
      <Card size="sm">
        <CardBody>
          <Stack gap={2} align="start">
            <Button
              variant="outline"
              aria-describedby={`${id}-local`}
              onClick={() => {
                onPreset("ollama");
              }}
            >
              {t("assistant.start.local")}
            </Button>
            <Text size="sm" tone="muted" id={`${id}-local`}>
              {t("assistant.start.local.detail")}
            </Text>
          </Stack>
        </CardBody>
      </Card>
      <Card size="sm">
        <CardBody>
          <Stack gap={2} align="start">
            <Button
              variant="outline"
              aria-describedby={`${id}-external`}
              onClick={onExternal}
            >
              {t("assistant.start.external")}
            </Button>
            <Text size="sm" tone="muted" id={`${id}-external`}>
              {t("assistant.start.external.detail")}
            </Text>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
