import { CodeBlock } from "@slotted/react/code-block";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";

// A195.2: the commands of docs/install for the release named; a re-run of the installation is
// the upgrade (A163.9).
const download = "https://github.com/andrelopes-code/equori/releases/download";

interface UpgradeComposeProps {
  version: string;
}

export function UpgradeCompose({ version }: UpgradeComposeProps) {
  const t = useT();

  const windowsCommand = `irm ${download}/${version}/install.ps1 | iex`;
  const unixCommand = `curl -fsSL ${download}/${version}/install.sh | sh`;

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
