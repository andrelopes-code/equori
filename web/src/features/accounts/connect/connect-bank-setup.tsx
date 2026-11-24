import { Button } from "@slotted/react/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { useNavigate } from "@tanstack/react-router";

import { useT } from "@/i18n/i18n-provider";

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
