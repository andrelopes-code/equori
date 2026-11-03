import { CodeBlock } from "@slotted/react/code-block";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";

// A195.2: the commands of docs/install; a re-run of the installation is the upgrade (A163.9).
const windowsCommand =
  "irm https://github.com/andrelopes-code/equori/releases/latest/download/install.ps1 | iex";
const unixCommand =
  "curl -fsSL https://github.com/andrelopes-code/equori/releases/latest/download/install.sh | sh";

export function UpgradeCompose() {
  const t = useT();

  return (
    <Stack gap={4}>
      <Text>{t("upgrade.compose.lead")}</Text>
      <CodeBlock
        code={windowsCommand}
        language="powershell"
        title={t("upgrade.compose.windows")}
      />
      <CodeBlock
        code={unixCommand}
        language="shell"
        title={t("upgrade.compose.unix")}
      />
      <Text tone="muted">{t("upgrade.compose.backup")}</Text>
    </Stack>
  );
}
