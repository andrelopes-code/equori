import { Button } from "@slotted/react/button";
import {
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Text } from "@slotted/react/typography";
import { useNavigate } from "@tanstack/react-router";

import { useT } from "@/i18n/i18n-provider";
import { AppLink } from "@/ui/navigation/app-link";

interface ConnectBankSetupProps {
  onClose: () => void;
}

export function ConnectBankSetup({ onClose }: ConnectBankSetupProps) {
  const t = useT();
  const navigate = useNavigate();

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("links.connect")}</DialogTitle>
        <DialogDescription>{t("links.connect.setup")}</DialogDescription>
      </DialogHeader>

      <DialogBody>
        <Text size="sm">
          <AppLink
            to={{
              to: "/help/$page",
              params: { page: "connect-bank" },
              hash: "credentials",
            }}
          >
            {t("links.connect.credentialsGuide")}
          </AppLink>
        </Text>
      </DialogBody>

      <DialogFooter>
        <Button variant="ghost" tone="secondary" onClick={onClose}>
          {t("detail.cancel")}
        </Button>
        <Button
          onClick={() => {
            void navigate({
              to: "/settings",
              search: { section: "integrations" },
            });
          }}
        >
          {t("links.connect.setupAction")}
        </Button>
      </DialogFooter>
    </>
  );
}
