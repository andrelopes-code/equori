import { Inline } from "@slotted/react/inline";
import { Link } from "@slotted/react/link";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { ConnectLauncher } from "@/features/accounts/connect/connect-launchers";
import styles from "@/features/accounts/connect/connect-steps.module.css";
import { useT } from "@/i18n/i18n-provider";
import { AppLink } from "@/ui/navigation/app-link";

interface ConnectStepsProps {
  launcher: ConnectLauncher;
}

export function ConnectSteps({ launcher }: ConnectStepsProps) {
  const t = useT();

  return (
    <Stack gap={3}>
      <ol className={styles.list}>
        {launcher.steps.map((step) => (
          <li key={step}>
            <Text size="sm">{t(step)}</Text>
          </li>
        ))}
      </ol>

      <Text size="sm">
        <Inline gap={4}>
          <Link href={launcher.portalUrl} external>
            {t(launcher.portalLabel)}
          </Link>
          <AppLink to={{ to: "/help/$page", params: { page: "connect-bank" } }}>
            {t("links.connect.guide")}
          </AppLink>
        </Inline>
      </Text>
    </Stack>
  );
}
