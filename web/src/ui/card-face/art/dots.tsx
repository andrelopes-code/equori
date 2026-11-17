import { useId } from "react";

import { ArtCanvas } from "@/ui/card-face/art/art-canvas";

export function Dots() {
  const id = useId();

  return (
    <ArtCanvas>
      <defs>
        <pattern id={id} width="11" height="11" patternUnits="userSpaceOnUse">
          <circle cx="5.5" cy="5.5" r="1.5" fill="currentColor" />
        </pattern>
        <radialGradient id={`${id}g`} cx="1" cy="1" r="1.05">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset=".55" stopColor="#fff" stopOpacity=".18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}m`}>
          <rect width="400" height="252" fill={`url(#${id}g)`} />
        </mask>
      </defs>

      <rect
        width="400"
        height="252"
        fill={`url(#${id})`}
        mask={`url(#${id}m)`}
      />
    </ArtCanvas>
  );
}
