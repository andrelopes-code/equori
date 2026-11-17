import { useId } from "react";

import { ArtCanvas } from "@/ui/card-face/art/art-canvas";

export function Carbon() {
  const id = useId();

  return (
    <ArtCanvas>
      <defs>
        <pattern
          id={id}
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="7" height="3.5" fill="#fff" fillOpacity=".06" />
          <rect y="3.5" width="7" height="3.5" fill="#000" fillOpacity=".2" />
          <rect width="3.5" height="7" fill="#000" fillOpacity=".1" />
        </pattern>
      </defs>

      <rect width="400" height="252" fill={`url(#${id})`} />
    </ArtCanvas>
  );
}
