import { Button, IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";

import { useT } from "@/i18n/i18n-provider";

// A page has room for the actions as buttons; the pane beside the list folds them into one
// menu so the title keeps its line (LA-03).
export function DetailActions({
  host,
  voided,
  transfer,
  inflow,
  expense,
  onCorrect,
  onTransfer,
  onReimburse,
  onRepay,
  onVoid,
  onOpenPage,
  onClose,
}: {
  host: "page" | "pane";
  voided: boolean;
  transfer: boolean;
  inflow: boolean;
  expense: boolean;
  onCorrect: () => void;
  onTransfer: () => void;
  onReimburse: () => void;
  onRepay: () => void;
  onVoid: () => void;
  onOpenPage: () => void;
  onClose?: (() => void) | undefined;
}) {
  const t = useT();
  if (host === "page") {
    if (voided) return null;
    return (
      <Inline gap={2} wrap="nowrap">
        <Button
          size="sm"
          variant="outline"
          tone="secondary"
          onClick={onCorrect}
        >
          {t("detail.correct")}
        </Button>
        {!transfer && (
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            onClick={onTransfer}
          >
            {t("detail.transfer")}
          </Button>
        )}
        {expense && (
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            onClick={onRepay}
          >
            {t("detail.repay")}
          </Button>
        )}
        {inflow && (
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            onClick={onReimburse}
          >
            {t("detail.reimburse")}
          </Button>
        )}
        <Button size="sm" variant="ghost" tone="danger" onClick={onVoid}>
          {t("detail.void")}
        </Button>
      </Inline>
    );
  }
  return (
    <Inline gap={1} wrap="nowrap">
      <Menu>
        <MenuTrigger
          render={(props) => (
            <IconButton
              {...props}
              aria-label={t("detail.actions")}
              variant="ghost"
              tone="secondary"
            >
              <Icon>
                <Glyph name="ellipsis" />
              </Icon>
            </IconButton>
          )}
        />
        <MenuContent>
          {!voided && (
            <MenuItem onSelect={onCorrect}>{t("detail.correct")}</MenuItem>
          )}
          {!voided && !transfer && (
            <MenuItem onSelect={onTransfer}>{t("detail.transfer")}</MenuItem>
          )}
          {!voided && expense && (
            <MenuItem onSelect={onRepay}>{t("detail.repay")}</MenuItem>
          )}
          {!voided && inflow && (
            <MenuItem onSelect={onReimburse}>{t("detail.reimburse")}</MenuItem>
          )}
          <MenuItem onSelect={onOpenPage}>{t("detail.openPage")}</MenuItem>
          {!voided && <MenuSeparator />}
          {!voided && (
            <MenuItem tone="danger" onSelect={onVoid}>
              {t("detail.void")}
            </MenuItem>
          )}
        </MenuContent>
      </Menu>
      {onClose !== undefined && (
        <IconButton
          aria-label={t("detail.close")}
          variant="ghost"
          tone="secondary"
          onClick={onClose}
        >
          <Icon>
            <Glyph name="x" />
          </Icon>
        </IconButton>
      )}
    </Inline>
  );
}
