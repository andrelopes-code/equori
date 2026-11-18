import { Button } from "@slotted/react/button";
import { Icon } from "@slotted/react/icon";
import { MediaViewer } from "@slotted/react/media-viewer";
import { useState } from "react";

import { HelpIcon } from "@/features/help/icon/help-icon";
import { useT } from "@/i18n/i18n-provider";

interface HelpEnlargeProps {
  // The files of both schemes; the viewer opens the one of the scheme in force.
  dark: string;
  light: string;
  name: string;
  type: "image/png" | "video/webm";
}

// The capture or the video at the size of the window.
export function HelpEnlarge({ dark, light, name, type }: HelpEnlargeProps) {
  const t = useT();
  const [src, setSrc] = useState<string | null>(null);

  const handleOpen = () => {
    const scheme = document.documentElement.getAttribute("data-slotted-scheme");

    setSrc(scheme === "light" ? light : dark);
  };

  return (
    <>
      <Button
        variant="ghost"
        tone="secondary"
        size="sm"
        start={
          <Icon size="sm">
            <HelpIcon name="expand" />
          </Icon>
        }
        onClick={handleOpen}
      >
        {t("help.figure.enlarge")}
      </Button>

      {src !== null && (
        <MediaViewer
          items={[{ id: src, src, name, type }]}
          open
          onOpenChange={(open) => {
            if (!open) setSrc(null);
          }}
        />
      )}
    </>
  );
}
