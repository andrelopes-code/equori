import { Button, IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";
import { toast } from "@slotted/react/toast";
import { useState } from "react";

import { ThemeDeleteDialog } from "@/features/setup/theme-delete-dialog";
import { ThemeImportDialog } from "@/features/setup/theme-import-dialog";
import { ThemeNameDialog } from "@/features/setup/theme-name-dialog";
import type { ThemeLibrary } from "@/features/setup/use-theme-library";
import { useT } from "@/i18n/i18n-provider";
import { exportTheme } from "@/theme/theme-file";
import type { ThemeValues } from "@/theme/themes";

export interface AppearanceToolbarProps {
  library: ThemeLibrary;
}

type Open = "save" | "rename" | "delete" | "import" | null;

// The actions on the active theme, as buttons of the page header: save, import, export, rename
// and delete.
export function AppearanceToolbar({ library }: AppearanceToolbarProps) {
  const t = useT();

  const [open, setOpen] = useState<Open>(null);

  const custom = library.activeName === null;
  const exportName = library.activeName ?? t("settings.theme.custom");
  const saved = library.activeSaved;

  function handleCopy() {
    const text = exportTheme(exportName, library.values);
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.show({ tone: "success", title: t("settings.theme.copied") });
      })
      .catch(() => {
        download(exportName, text);
      });
  }

  function handleImport(name: string, values: ThemeValues) {
    if (library.full) {
      toast.show({ tone: "danger", title: t("settings.theme.limit") });
      return;
    }

    library.save(name, values);
    toast.show({
      tone: "success",
      title: t("settings.theme.imported", { name }),
    });
  }

  function handleSave() {
    if (library.full)
      toast.show({ tone: "danger", title: t("settings.theme.limit") });
    else setOpen("save");
  }

  const close = () => {
    setOpen(null);
  };

  return (
    <>
      <Menu>
        <MenuTrigger
          render={(props) => (
            <IconButton
              {...props}
              variant="ghost"
              tone="secondary"
              aria-label={t("settings.theme.more")}
            >
              <Icon>
                <Glyph name="ellipsis" />
              </Icon>
            </IconButton>
          )}
        />
        <MenuContent>
          <MenuItem onSelect={handleCopy}>{t("settings.theme.copy")}</MenuItem>
          <MenuItem
            onSelect={() => {
              download(exportName, exportTheme(exportName, library.values));
            }}
          >
            {t("settings.theme.download")}
          </MenuItem>
          {saved !== null && (
            <>
              <MenuSeparator />
              <MenuItem
                onSelect={() => {
                  setOpen("rename");
                }}
              >
                {t("settings.theme.rename")}
              </MenuItem>
              <MenuItem
                tone="danger"
                onSelect={() => {
                  setOpen("delete");
                }}
              >
                {t("settings.theme.delete")}
              </MenuItem>
            </>
          )}
        </MenuContent>
      </Menu>
      <Button
        variant="outline"
        tone="secondary"
        onClick={() => {
          setOpen("import");
        }}
      >
        {t("settings.theme.import")}
      </Button>
      <Button
        variant={custom ? "solid" : "outline"}
        tone={custom ? "accent" : "secondary"}
        onClick={handleSave}
      >
        {t("settings.theme.save")}
      </Button>

      {open === "save" && (
        <ThemeNameDialog
          title={t("settings.theme.saveTitle")}
          description={t("settings.theme.saveHint")}
          initialName={custom ? "" : exportName}
          onSubmit={(name) => {
            library.save(name, library.values);
          }}
          onClose={close}
        />
      )}
      {open === "rename" && saved !== null && (
        <ThemeNameDialog
          title={t("settings.theme.renameTitle")}
          initialName={saved.name}
          onSubmit={(name) => {
            library.rename(saved.id, name);
          }}
          onClose={close}
        />
      )}
      {open === "delete" && saved !== null && (
        <ThemeDeleteDialog
          name={saved.name}
          onDelete={() => {
            library.remove(saved.id);
          }}
          onClose={close}
        />
      )}
      {open === "import" && (
        <ThemeImportDialog onImport={handleImport} onClose={close} />
      )}
    </>
  );
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/[^\p{L}\p{N}_-]+/gu, "-")}.equori-theme.json`;
  link.click();
  URL.revokeObjectURL(url);
}
