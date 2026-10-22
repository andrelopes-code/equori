import { Button, IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import type { GlyphName } from "@slotted/core/glyph";

import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

// LA-03: below 600 px a labelled header action becomes its icon-only form on the title's line.
export function HeaderAction({
  label,
  glyph,
  onClick,
  loading = false,
  primary = false,
}: {
  label: string;
  glyph: GlyphName;
  onClick: () => void;
  loading?: boolean;
  primary?: boolean;
}) {
  const compact = useMediaQuery(compactQuery);
  const variant = primary ? "solid" : "outline";
  const tone = primary ? "accent" : "secondary";
  return compact ? (
    <IconButton
      aria-label={label}
      variant={variant}
      tone={tone}
      loading={loading}
      onClick={onClick}
    >
      <Icon>
        <Glyph name={glyph} />
      </Icon>
    </IconButton>
  ) : (
    <Button
      variant={variant}
      tone={tone}
      loading={loading}
      start={
        <Icon size="sm">
          <Glyph name={glyph} />
        </Icon>
      }
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
