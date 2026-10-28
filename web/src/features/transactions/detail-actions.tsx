import { Button, IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Toolbar, ToolbarItem, ToolbarOverflow } from "@slotted/react/toolbar";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";

import { useT } from "@/i18n/i18n-provider";

// On the page the actions stand in a toolbar that folds into its menu what the width beside the
// title cannot hold; the pane beside the list folds them all into one menu so the title keeps its
// line (LA-03).
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
      <Toolbar aria-label={t("detail.actions")} overflow="menu">
        <ToolbarItem
          counterpart={
            <MenuItem onSelect={onCorrect}>{t("detail.correct")}</MenuItem>
          }
        >
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            onClick={onCorrect}
          >
            {t("detail.correct")}
          </Button>
        </ToolbarItem>
        {!transfer && (
          <ToolbarItem
            counterpart={
              <MenuItem onSelect={onTransfer}>{t("detail.transfer")}</MenuItem>
            }
          >
            <Button
              size="sm"
              variant="outline"
              tone="secondary"
              onClick={onTransfer}
            >
              {t("detail.transfer")}
            </Button>
          </ToolbarItem>
        )}
        {expense && (
          <ToolbarItem
            counterpart={
              <MenuItem onSelect={onRepay}>{t("detail.repay")}</MenuItem>
            }
          >
            <Button
              size="sm"
              variant="outline"
              tone="secondary"
              onClick={onRepay}
            >
              {t("detail.repay")}
            </Button>
          </ToolbarItem>
        )}
        {inflow && (
          <ToolbarItem
            counterpart={
              <MenuItem onSelect={onReimburse}>
                {t("detail.reimburse")}
              </MenuItem>
            }
          >
            <Button
              size="sm"
              variant="outline"
              tone="secondary"
              onClick={onReimburse}
            >
              {t("detail.reimburse")}
            </Button>
          </ToolbarItem>
        )}
        <ToolbarItem
          counterpart={
            <MenuItem tone="danger" onSelect={onVoid}>
              {t("detail.void")}
            </MenuItem>
          }
        >
          <Button size="sm" variant="ghost" tone="danger" onClick={onVoid}>
            {t("detail.void")}
          </Button>
        </ToolbarItem>
        <ToolbarOverflow />
      </Toolbar>
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
